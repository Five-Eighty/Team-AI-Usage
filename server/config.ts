import type { TeamMember } from '../src/types/index.js';

// Configure your team members here.
// IDs should match the user identifiers used in each AI service
// (e.g., OpenAI user_id, email addresses, etc.)
export const teamMembers: TeamMember[] = [
  {
    id: 'member-1',
    name: 'Alice Chen',
    email: 'alice@example.com',
    role: 'Engineering Lead',
  },
  {
    id: 'member-2',
    name: 'Bob Martinez',
    email: 'bob@example.com',
    role: 'Senior Developer',
  },
  {
    id: 'member-3',
    name: 'Carol Johnson',
    email: 'carol@example.com',
    role: 'Product Designer',
  },
  {
    id: 'member-4',
    name: 'David Kim',
    email: 'david@example.com',
    role: 'Data Scientist',
  },
  {
    id: 'member-5',
    name: 'Elena Rodriguez',
    email: 'elena@example.com',
    role: 'Full Stack Developer',
  },
];
