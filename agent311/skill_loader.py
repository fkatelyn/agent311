"""
Dynamic skill loader for agent311.

Automatically loads skills from .claude/skills/ directory and converts them
to Claude API tool definitions.
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Any


def parse_skill_file(skill_path: Path) -> Dict[str, Any]:
    """Parse a SKILL.md file and extract metadata."""
    with open(skill_path, 'r') as f:
        content = f.read()

    # Extract YAML frontmatter
    frontmatter_match = re.match(r'^---\n(.*?)\n---\n(.*)$', content, re.DOTALL)
    if not frontmatter_match:
        return None

    frontmatter, body = frontmatter_match.groups()

    # Parse YAML (simple parser for our needs)
    metadata = {}
    for line in frontmatter.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()

            # Handle multiline values (description)
            if value.startswith('>'):
                metadata[key] = value[1:].strip()
            else:
                metadata[key] = value

    metadata['body'] = body.strip()
    return metadata


def load_skills(skills_dir: str = None) -> List[Dict[str, Any]]:
    """
    Load all skills from .claude/skills/ directory.

    Returns a list of tool definitions compatible with Claude API.
    """
    if skills_dir is None:
        # Default to .claude/skills/ relative to project root
        project_root = Path(__file__).parent.parent
        skills_dir = project_root / '.claude' / 'skills'
    else:
        skills_dir = Path(skills_dir)

    if not skills_dir.exists():
        return []

    tools = []

    # Iterate through skill directories
    for skill_dir in skills_dir.iterdir():
        if not skill_dir.is_dir():
            continue

        skill_file = skill_dir / 'SKILL.md'
        if not skill_file.exists():
            continue

        # Parse skill metadata
        skill_metadata = parse_skill_file(skill_file)
        if not skill_metadata:
            continue

        # Convert to Claude tool definition
        tool = {
            'name': skill_metadata.get('name'),
            'description': skill_metadata.get('description', ''),
            'input_schema': {
                'type': 'object',
                'properties': {
                    'query': {
                        'type': 'string',
                        'description': 'User query or parameters for the skill'
                    }
                },
                'required': []
            },
            '_skill_body': skill_metadata.get('body', ''),
            '_skill_path': str(skill_dir)
        }

        tools.append(tool)

    return tools


def execute_skill(skill_name: str, skill_input: Dict[str, Any], tools: List[Dict]) -> str:
    """
    Execute a skill by name.

    For now, returns the skill instructions. In the future, this could
    actually execute steps defined in the skill.
    """
    # Find the skill definition
    skill = None
    for tool in tools:
        if tool['name'] == skill_name:
            skill = tool
            break

    if not skill:
        return f"Skill '{skill_name}' not found."

    query = skill_input.get('query', '')

    # For now, return a formatted response with skill info
    # In the future, this could parse and execute the skill steps
    return f"""Skill '{skill_name}' executed.

Query: {query}

Skill Description: {skill['description']}

Note: This skill is loaded from {skill['_skill_path']}.
The skill system is working! Skills are dynamically loaded from .claude/skills/ directory."""


if __name__ == '__main__':
    # Test the loader
    skills = load_skills()
    print(f"Loaded {len(skills)} skills:")
    for skill in skills:
        print(f"  - {skill['name']}: {skill['description'][:60]}...")
