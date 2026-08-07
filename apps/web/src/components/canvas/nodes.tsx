'use client';

import { memo, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import { useTranslations } from 'next-intl';
import { solid, tint } from '@/lib/colors';
import { OrbitIcon } from '@/lib/icons';
import { useAppStore } from '@/store/app-store';
import {
  C,
  type CompanyCardNode,
  type CompanyLabelNode,
  type DomainBoxNode,
  type DomainCardNode,
  type RootCardNode,
  type TeamFlowNode,
  type TribeCardNode,
  type TribeLabelNode,
} from './layout';

const hiddenHandleStyle: CSSProperties = {
  opacity: 0,
  width: 4,
  height: 4,
  minWidth: 4,
  minHeight: 4,
  border: 'none',
  pointerEvents: 'none',
};

function HiddenHandle({ type, position }: { type: 'source' | 'target'; position: Position }) {
  return <Handle type={type} position={position} style={hiddenHandleStyle} isConnectable={false} />;
}

const teamHue = (hue: number | null, domainHue: number): number =>
  hue != null ? hue : domainHue;

/** Team card 214×64 — icon tile (13% tint), Sora 600 name, mono queue key in team color. */
const TeamNode = memo(function TeamNode({ data }: NodeProps<TeamFlowNode>) {
  const { team, hue, density, dim, sel } = data;
  const compact = density === 'compact';
  return (
    <div
      style={{
        width: C.cardW,
        height: Math.round(C.cardH * (compact ? 0.86 : 1)),
        boxSizing: 'border-box',
        padding: compact ? '7px 9px' : '9px 10px',
        borderRadius: 12,
        background: 'var(--surface)',
        border: `1px solid ${sel ? solid(hue) : 'var(--border)'}`,
        boxShadow: sel ? `0 0 0 3px ${tint(hue, 0.22)}` : 'var(--card-shadow)',
        opacity: dim ? 0.2 : 1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        transition: 'opacity .15s, box-shadow .15s, border-color .15s',
        fontFamily: 'var(--font-sora)',
      }}
    >
      <HiddenHandle type="target" position={Position.Left} />
      <HiddenHandle type="source" position={Position.Right} />
      <div
        style={{
          width: compact ? 26 : 30,
          height: compact ? 26 : 30,
          borderRadius: 9,
          background: tint(hue, 0.13),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <OrbitIcon name={team.icon} size={compact ? 13 : 15} color={solid(hue)} />
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: compact ? 11.5 : 12.5,
            fontWeight: 600,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {team.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            letterSpacing: '.02em',
            color: solid(hue),
          }}
        >
          {team.queueKey}
        </span>
      </div>
    </div>
  );
});

/** Dashed tinted rounded box around a domain's tribe columns. */
const DomainBox = memo(function DomainBox({ data }: NodeProps<DomainBoxNode>) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: 18,
        background: tint(data.hue, 0.05),
        border: `1.5px dashed ${tint(data.hue, 0.38)}`,
        padding: '12px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sora)' }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{data.name}</span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: solid(data.hue),
            background: tint(data.hue, 0.13),
            borderRadius: 99,
            padding: '1px 8px',
          }}
        >
          {data.count}
        </span>
      </div>
    </div>
  );
});

const TribeLabel = memo(function TribeLabel({ data }: NodeProps<TribeLabelNode>) {
  return (
    <div
      style={{
        width: C.cardW,
        fontFamily: 'var(--font-sora)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {data.name}
    </div>
  );
});

const CompanyLabel = memo(function CompanyLabel({ data }: NodeProps<CompanyLabelNode>) {
  const t = useTranslations();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-sora)' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: tint(data.hue, 0.14),
          border: `1px solid ${tint(data.hue, 0.32)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <OrbitIcon name={data.icon} size={20} color={solid(data.hue)} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>
          {data.name}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--muted)',
            fontFamily: 'var(--font-sans)',
            marginTop: 1,
          }}
        >
          {data.count} {t('teams')}  ·  Confluence {data.pageId}
        </div>
      </div>
    </div>
  );
});

const RootCard = memo(function RootCard({ data }: NodeProps<RootCardNode>) {
  const t = useTranslations();
  return (
    <div
      style={{
        width: 280,
        boxSizing: 'border-box',
        padding: '16px 20px',
        borderRadius: 16,
        background: 'var(--deep)',
        color: '#fff',
        fontFamily: 'var(--font-sora)',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,.12)',
        opacity: data.dim ? 0.25 : 1,
        transition: 'opacity .15s',
      }}
    >
      <HiddenHandle type="source" position={Position.Bottom} />
      <div style={{ fontSize: 17, fontWeight: 700 }}>{data.name}</div>
      <div
        style={{ fontSize: 11.5, opacity: 0.85, marginTop: 3, fontFamily: 'var(--font-sans)' }}
      >
        {data.companies} {t('companies')} · {data.teams} {t('teams')}
      </div>
    </div>
  );
});

const CompanyCard = memo(function CompanyCard({ data }: NodeProps<CompanyCardNode>) {
  const t = useTranslations();
  return (
    <div
      style={{
        width: 250,
        boxSizing: 'border-box',
        padding: '12px 15px',
        borderRadius: 14,
        background: 'var(--surface)',
        border: `1.5px solid ${tint(data.hue, 0.5)}`,
        boxShadow: data.selB ? '0 0 0 3px var(--ring)' : 'var(--card-shadow)',
        fontFamily: 'var(--font-sora)',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        opacity: data.dim ? 0.22 : 1,
        transition: 'opacity .15s, box-shadow .15s',
      }}
    >
      <HiddenHandle type="target" position={Position.Top} />
      <HiddenHandle type="source" position={Position.Bottom} />
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: tint(data.hue, 0.14),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <OrbitIcon name={data.icon} size={17} color={solid(data.hue)} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.name}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-sans)' }}>
          {data.teams} {t('teams')} · {data.pageId}
        </div>
      </div>
    </div>
  );
});

const DomainCard = memo(function DomainCard({ data }: NodeProps<DomainCardNode>) {
  return (
    <div
      style={{
        width: 220,
        boxSizing: 'border-box',
        padding: '11px 14px',
        borderRadius: 12,
        background: tint(data.hue, 0.1),
        border: `1.5px solid ${tint(data.hue, 0.42)}`,
        fontFamily: 'var(--font-sora)',
        boxShadow: data.selB ? '0 0 0 3px var(--ring)' : 'none',
        opacity: data.dim ? 0.22 : 1,
        transition: 'opacity .15s, box-shadow .15s',
      }}
    >
      <HiddenHandle type="target" position={Position.Top} />
      <HiddenHandle type="source" position={Position.Bottom} />
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{data.name}</div>
      <div
        style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}
      >
        {data.tribes} tribes · {data.teams} teams
      </div>
    </div>
  );
});

/** Tribe card with clickable team rows (hierarchy view). */
const TribeCard = memo(function TribeCard({ data }: NodeProps<TribeCardNode>) {
  const select = useAppStore((s) => s.select);
  return (
    <div
      style={{
        width: 224,
        boxSizing: 'border-box',
        borderRadius: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: data.selB ? '0 0 0 3px var(--ring)' : 'var(--card-shadow)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sora)',
        opacity: data.dim ? 0.22 : 1,
        transition: 'opacity .15s, box-shadow .15s',
      }}
    >
      <HiddenHandle type="target" position={Position.Top} />
      <div
        style={{
          padding: '8px 12px 7px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: solid(data.hue),
          background: tint(data.hue, 0.08),
          borderBottom: '1px solid var(--border)',
        }}
      >
        {data.name}
      </div>
      <div>
        {data.teams.map((team, i) => {
          const isSel = data.sel === team.queueKey;
          const hue = teamHue(team.hue, data.hue);
          return (
            <div
              key={team.queueKey}
              onClick={(e) => {
                e.stopPropagation();
                select(team.queueKey);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 11.5,
                color: 'var(--text)',
                background: isSel ? tint(hue, 0.14) : 'transparent',
                borderTop: i ? '1px solid var(--border-soft)' : 'none',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <OrbitIcon name={team.icon} size={12} color={solid(hue)} />
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  fontWeight: isSel ? 600 : 400,
                }}
              >
                {team.name}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontFamily: 'ui-monospace, monospace',
                  color: 'var(--muted)',
                  flex: 'none',
                }}
              >
                {team.queueKey}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export const nodeTypes: NodeTypes = {
  team: TeamNode,
  domainBox: DomainBox,
  tribeLabel: TribeLabel,
  companyLabel: CompanyLabel,
  rootCard: RootCard,
  companyCard: CompanyCard,
  domainCard: DomainCard,
  tribeCard: TribeCard,
};
