import { Injectable } from '@nestjs/common';

import type { Team } from '@orbit/shared';

export interface TeamPath {
  company: string;
  domain: string;
  tribe: string;
}

/**
 * Flattens one team into the plain-text document the assistant-service
 * retrieves over (one row per team in team_documents). Deterministic output:
 * unchanged teams produce byte-identical content, so their embeddings survive
 * a sync untouched.
 */
@Injectable()
export class TeamDocumentBuilder {
  build(team: Team, path: TeamPath): string {
    const lines = [
      `Team: ${team.name} (${team.queueKey})`,
      `Path: ${path.company} > ${path.domain} > ${path.tribe}`,
    ];
    if (team.description) lines.push(`Description: ${team.description}`);
    if (team.apps.length > 0) lines.push(`Applications: ${team.apps.join(', ')}`);
    if (team.keywords.length > 0) lines.push(`Keywords: ${team.keywords.join(', ')}`);
    if (team.channel) lines.push(`Channel: ${team.channel}`);
    if (team.lead) lines.push(`Team lead: ${team.lead}`);
    if (team.oncall) lines.push(`On-call: ${team.oncall}`);
    return lines.join('\n');
  }
}
