import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Swagger mirrors of the shared zod contracts (packages/shared). Responses are
 * produced and validated by the zod schemas; these classes exist for /docs. */

export class GroupDto {
  @ApiProperty({ example: 'Aurora Group' }) name!: string;
  @ApiProperty({ example: 'globe' }) icon!: string;
  @ApiProperty({ example: 262, minimum: 0, maximum: 360 }) hue!: number;
}

export class CompanyDto {
  @ApiProperty({ example: 'nova' }) slug!: string;
  @ApiProperty({ example: 'NovaPay' }) name!: string;
  @ApiProperty({ example: 'wallet' }) icon!: string;
  @ApiProperty({ example: 245 }) hue!: number;
  @ApiProperty({ example: 'Payments and financial risk arm of the group.' }) description!: string;
  @ApiProperty({ example: '84213977' }) confluencePageId!: string;
  @ApiProperty({ example: 0 }) position!: number;
  @ApiProperty({ example: 27 }) teamCount!: number;
}

export class DomainDto {
  @ApiProperty({ example: 'pay' }) slug!: string;
  @ApiProperty({ example: 'nova' }) companySlug!: string;
  @ApiProperty({ example: 'Payments & Billing' }) name!: string;
  @ApiProperty({ example: 215 }) hue!: number;
  @ApiProperty() description!: string;
  @ApiProperty({ example: 0 }) position!: number;
}

export class TribeDto {
  @ApiProperty({ example: 'pay-acc' }) slug!: string;
  @ApiProperty({ example: 'pay' }) domainSlug!: string;
  @ApiProperty({ example: 'Acceptance' }) name!: string;
  @ApiProperty({ example: 0 }) position!: number;
}

export class TeamDto {
  @ApiProperty({ example: 'PAY-CHK' }) queueKey!: string;
  @ApiProperty({ example: 'Checkout' }) name!: string;
  @ApiProperty({ example: 'pay-acc' }) tribeSlug!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: 'cart' }) icon!: string;
  @ApiProperty({ nullable: true, type: Number, example: null }) hue!: number | null;
  @ApiProperty({ type: [String], example: ['Checkout Web', 'Pay SDK'] }) apps!: string[];
  @ApiProperty({ type: [String], example: ['payment failed', '3ds'] }) keywords!: string[];
  @ApiProperty({ nullable: true, type: String, example: '#pay-checkout' }) channel!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Mara Kis' }) lead!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'pay-checkout-oncall' }) oncall!:
    | string
    | null;
}

export class TeamLinkDto {
  @ApiProperty({ example: 'PAY-CHK' }) source!: string;
  @ApiProperty({ example: 'DATA-FRM' }) target!: string;
  @ApiProperty({ example: 'fraud scoring at checkout' }) reason!: string;
}

export class RegistrySnapshotDto {
  @ApiProperty({ type: GroupDto }) group!: GroupDto;
  @ApiProperty({ type: [CompanyDto] }) companies!: CompanyDto[];
  @ApiProperty({ type: [DomainDto] }) domains!: DomainDto[];
  @ApiProperty({ type: [TribeDto] }) tribes!: TribeDto[];
  @ApiProperty({ type: [TeamDto] }) teams!: TeamDto[];
  @ApiProperty({ type: [TeamLinkDto] }) links!: TeamLinkDto[];
  @ApiProperty({ nullable: true, type: String, example: '2026-08-07T10:00:00.000Z' }) lastSync!:
    | string
    | null;
}

export class SyncRunDto {
  @ApiProperty({ example: 12 }) id!: number;
  @ApiProperty({ example: '2026-08-07T10:00:00.000Z' }) startedAt!: string;
  @ApiProperty({ nullable: true, type: String }) finishedAt!: string | null;
  @ApiProperty({ enum: ['running', 'success', 'failed'] }) status!: string;
  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: { pages: 3, teams: 81, links: 30 },
  })
  stats!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: String }) error!: string | null;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ example: 'up' }) db!: string;
  @ApiProperty({ example: 'up' }) redis!: string;
}

export class ErrorDto {
  @ApiProperty({ example: 404 }) status!: number;
  @ApiProperty({ example: 'Unknown team queue key "XXX-YYY"' }) message!: string;
  @ApiPropertyOptional({ description: 'Present only when NODE_ENV=development' }) stack?: string;
}
