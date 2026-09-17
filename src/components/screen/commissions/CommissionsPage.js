'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Button, Input, Select, Segmented, Empty, Spin, App, Avatar,
  DatePicker, Drawer, Tooltip, Progress, Alert,
} from 'antd';
import {
  ReloadOutlined, DollarOutlined, SearchOutlined, GiftOutlined,
  PrinterOutlined, UserOutlined, RightOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useAuth } from '@/lib/AuthProvider';
import {
  getAgentCommissions,
  getAgentPayouts,
  fetchAllAgents,
  summarizeCommissions,
  getCommissionConfig,
  rateLabel,
  fmtMoney,
  toNum,
  COMMISSION_SOURCE,
  COMMISSION_STATUS,
  SOURCE_LABEL,
} from '@/lib/services/commissionService';
import PayCommissionDrawer from '../agents/agentDetails/component/Commission/PayCommissionDrawer';
import { useCan } from '@/components/base/Can';
import { TrsutData } from '@/lib/constentData';

const { RangePicker } = DatePicker;
const { Option } = Select;

const StatCard = ({ label, value, sub, color, icon }) => (
  <div
    style={{
      flex: 1,
      minWidth: 180,
      background: color.bg,
      border: `1px solid ${color.border}`,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}
  >
    {icon && (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: '#fff',
          border: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color.text,
          fontSize: 17,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    )}
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#6b7280',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color.text, lineHeight: 1.15, marginTop: 2 }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</div> : null}
    </div>
  </div>
);

/* ── Print all-agents statement ────────────────────────────────────────── */
const printAll = (rows, totals, rangeLabel) => {
  const body = rows
    .map(
      (r, i) => `
    <tr class="${i % 2 ? 'alt' : ''}">
      <td class="center">${i + 1}</td>
      <td>${r.agent.displayName || '-'}<div class="sub">${r.agent.agentCode || ''}</div></td>
      <td class="center">${r.rateText}</td>
      <td class="center">${r.summary.total}</td>
      <td class="right">&#8377;${r.summary.joinFeesAmount.toLocaleString('en-IN')}</td>
      <td class="right">&#8377;${r.summary.closingAmount.toLocaleString('en-IN')}</td>
      <td class="right">&#8377;${r.summary.earned.toLocaleString('en-IN')}</td>
      <td class="right paid">&#8377;${r.summary.paid.toLocaleString('en-IN')}</td>
      <td class="right pend">&#8377;${r.summary.pending.toLocaleString('en-IN')}</td>
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Agent Commission Summary</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1a1a2e}
  .page{width:297mm;min-height:210mm;padding:12mm;margin:0 auto;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:9pt;border-bottom:2pt solid #1d2a4a;margin-bottom:11pt}
  .brand{font-size:14pt;font-weight:700;color:#1d2a4a}
  .brand-sub{font-size:8.5pt;color:#6b7280;margin-top:2pt}
  .meta{text-align:right;font-size:8.5pt;color:#374151}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6pt;margin-bottom:12pt}
  .card{border:.75pt solid #e2e8f0;border-radius:5pt;padding:7pt 9pt;background:#f8fafc}
  .card-label{font-size:6.5pt;font-weight:700;letter-spacing:.6pt;text-transform:uppercase;color:#94a3b8}
  .card-value{font-size:13pt;font-weight:800;margin-top:2pt;color:#1d2a4a}
  table{width:100%;border-collapse:collapse;font-size:8.5pt}
  thead tr{background:#1d2a4a}
  thead th{color:#fff;font-size:7pt;font-weight:700;padding:5pt;text-align:left;letter-spacing:.4pt}
  th.center,td.center{text-align:center}th.right,td.right{text-align:right}
  tbody td{padding:4pt 5pt;border-bottom:.5pt solid #f1f5f9}
  tbody tr.alt td{background:#f8fafc}
  .sub{font-size:7pt;color:#94a3b8;font-family:'Courier New',monospace}
  td.paid{color:#16a34a;font-weight:700}
  td.pend{color:#dc2626;font-weight:700}
  tfoot td{padding:6pt 5pt;border-top:1.5pt solid #1d2a4a;font-weight:800}
</style></head><body><div class="page">
  <div class="header">
    <div>
      <div class="brand">${TrsutData?.name || 'Commission Summary'}</div>
      <div class="brand-sub">All Agents — Commission Summary</div>
    </div>
    <div class="meta">
      Period: ${rangeLabel}<br/>Generated: ${dayjs().format('DD MMM YYYY, hh:mm A')}
    </div>
  </div>

  <div class="summary">
    <div class="card"><div class="card-label">Total Earned</div><div class="card-value">&#8377;${totals.earned.toLocaleString('en-IN')}</div></div>
    <div class="card"><div class="card-label">Paid Out</div><div class="card-value">&#8377;${totals.paid.toLocaleString('en-IN')}</div></div>
    <div class="card"><div class="card-label">Pending</div><div class="card-value">&#8377;${totals.pending.toLocaleString('en-IN')}</div></div>
    <div class="card"><div class="card-label">Agents</div><div class="card-value">${rows.length}</div></div>
  </div>

  <table>
    <thead><tr>
      <th class="center">#</th><th>Agent</th><th class="center">Rate</th>
      <th class="center">Entries</th><th class="right">Join Fees</th><th class="right">Closing</th>
      <th class="right">Earned</th><th class="right">Paid</th><th class="right">Pending</th>
    </tr></thead>
    <tbody>${body || '<tr><td colspan="9" class="center">No data</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="6" class="right">TOTAL</td>
      <td class="right">&#8377;${totals.earned.toLocaleString('en-IN')}</td>
      <td class="right">&#8377;${totals.paid.toLocaleString('en-IN')}</td>
      <td class="right">&#8377;${totals.pending.toLocaleString('en-IN')}</td>
    </tr></tfoot>
  </table>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
};

/* ── Main page ─────────────────────────────────────────────────────────── */
const CommissionsPage = () => {
  const { user } = useAuth();
  const { message } = App.useApp();
  const canDo = useCan();
  const programList = useSelector((state) => state.data.programList) || [];

  const [agents, setAgents] = useState([]);
  const [commissionsByAgent, setCommissionsByAgent] = useState({});
  const [payoutsByAgent, setPayoutsByAgent] = useState({});
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [range, setRange] = useState(null);
  const [onlyPending, setOnlyPending] = useState(false);

  const [payAgent, setPayAgent] = useState(null);
  const [detailAgent, setDetailAgent] = useState(null);
  const [permError, setPermError] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const agentDocs = await fetchAllAgents(user.uid);
      setAgents(agentDocs);

      const entries = await Promise.all(
        agentDocs.map(async (a) => {
          const [c, p] = await Promise.all([
            getAgentCommissions(user.uid, a.id),
            getAgentPayouts(user.uid, a.id),
          ]);
          return [a.id, c, p];
        })
      );

      const cMap = {};
      const pMap = {};
      entries.forEach(([id, c, p]) => {
        cMap[id] = c;
        pMap[id] = p;
      });
      setCommissionsByAgent(cMap);
      setPayoutsByAgent(pMap);
      setPermError(false);
    } catch (err) {
      console.error(err);
      // Firestore rules commission path ko allow nahi kar rahi
      if (err?.code === 'permission-denied') {
        setPermError(true);
      } else {
        message.error('Commission data load nahi ho paya');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = useCallback(
    (list = []) => {
      let out = list;
      if (sourceFilter !== 'all') out = out.filter((c) => c.sourceType === sourceFilter);
      if (programFilter) out = out.filter((c) => c.programId === programFilter);
      if (range?.[0] && range?.[1]) {
        const s = range[0].startOf('day').valueOf();
        const e = range[1].endOf('day').valueOf();
        out = out.filter((c) => {
          const t = new Date(c.paymentDate || c.createdAt || 0).valueOf();
          return t >= s && t <= e;
        });
      }
      return out;
    },
    [sourceFilter, programFilter, range]
  );

  const rows = useMemo(() => {
    let out = agents.map((agent) => {
      const all = commissionsByAgent[agent.id] || [];
      const filtered = applyFilters(all);
      const cfg = getCommissionConfig(agent);
      return {
        key: agent.id,
        agent,
        config: cfg,
        rateText: !cfg.enabled
          ? 'Off'
          : `${cfg.joinFees.enabled ? rateLabel(cfg.joinFees.type, cfg.joinFees.value) : '—'} / ${
              cfg.closing.enabled ? rateLabel(cfg.closing.type, cfg.closing.value) : '—'
            }`,
        commissions: filtered,
        allCommissions: all,
        pendingEntries: all.filter((c) => c.status !== COMMISSION_STATUS.PAID),
        summary: summarizeCommissions(filtered),
        payoutCount: (payoutsByAgent[agent.id] || []).length,
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (r) =>
          r.agent.displayName?.toLowerCase().includes(q) ||
          r.agent.agentCode?.toLowerCase().includes(q) ||
          r.agent.phone?.includes(search) ||
          r.agent.city?.toLowerCase().includes(q)
      );
    }
    if (onlyPending) out = out.filter((r) => r.summary.pending > 0);

    return out.sort((a, b) => b.summary.pending - a.summary.pending || b.summary.earned - a.summary.earned);
  }, [agents, commissionsByAgent, payoutsByAgent, applyFilters, search, onlyPending]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.earned += r.summary.earned;
          acc.paid += r.summary.paid;
          acc.pending += r.summary.pending;
          acc.entries += r.summary.total;
          acc.joinFees += r.summary.joinFeesAmount;
          acc.closing += r.summary.closingAmount;
          if (r.summary.pending > 0) acc.agentsWithPending += 1;
          return acc;
        },
        { earned: 0, paid: 0, pending: 0, entries: 0, joinFees: 0, closing: 0, agentsWithPending: 0 }
      ),
    [rows]
  );

  const rangeLabel =
    range?.[0] && range?.[1]
      ? `${range[0].format('DD MMM YYYY')} – ${range[1].format('DD MMM YYYY')}`
      : 'All time';

  const columns = [
    {
      title: '#',
      key: 'i',
      width: 46,
      align: 'center',
      render: (_, __, i) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{i + 1}</span>,
    },
    {
      title: 'Agent',
      key: 'agent',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar src={r.agent.photoURL} icon={<UserOutlined />} size={34} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
              {r.agent.displayName || '—'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {r.agent.agentCode ? `#${r.agent.agentCode}` : ''}
              {r.agent.city ? ` · ${r.agent.city}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Rate (Join / Closing)',
      key: 'rate',
      width: 150,
      align: 'center',
      render: (_, r) =>
        r.config.enabled ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>{r.rateText}</span>
        ) : (
          <Tag color="default">Off</Tag>
        ),
    },
    {
      title: 'Entries',
      key: 'entries',
      width: 80,
      align: 'center',
      render: (_, r) => <span style={{ fontSize: 12, color: '#6b7280' }}>{r.summary.total}</span>,
    },
    {
      title: 'Join Fees',
      key: 'jf',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.summary.joinFeesAmount - b.summary.joinFeesAmount,
      render: (_, r) => (
        <span style={{ fontSize: 12, color: '#b45309' }}>{fmtMoney(r.summary.joinFeesAmount)}</span>
      ),
    },
    {
      title: 'Closing',
      key: 'cl',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.summary.closingAmount - b.summary.closingAmount,
      render: (_, r) => (
        <span style={{ fontSize: 12, color: '#1d4ed8' }}>{fmtMoney(r.summary.closingAmount)}</span>
      ),
    },
    {
      title: 'Earned',
      key: 'earned',
      width: 115,
      align: 'right',
      sorter: (a, b) => a.summary.earned - b.summary.earned,
      render: (_, r) => (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#4338ca' }}>
          {fmtMoney(r.summary.earned)}
        </span>
      ),
    },
    {
      title: 'Paid',
      key: 'paid',
      width: 115,
      align: 'right',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
            {fmtMoney(r.summary.paid)}
          </div>
          <Progress
            percent={r.summary.earned ? Math.round((r.summary.paid / r.summary.earned) * 100) : 0}
            size="small"
            showInfo={false}
            strokeColor="#22c55e"
          />
        </div>
      ),
    },
    {
      title: 'Pending',
      key: 'pending',
      width: 115,
      align: 'right',
      sorter: (a, b) => a.summary.pending - b.summary.pending,
      render: (_, r) => (
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: r.summary.pending > 0 ? '#b91c1c' : '#9ca3af',
          }}
        >
          {fmtMoney(r.summary.pending)}
        </span>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Tooltip title="Commission entries dekhein">
            <Button size="small" icon={<RightOutlined />} onClick={() => setDetailAgent(r)} />
          </Tooltip>
          <Button
            size="small"
            type="primary"
            icon={<DollarOutlined />}
            disabled={!r.pendingEntries.length || !canDo('commissions', 'create')}
            onClick={() => setPayAgent(r)}
            style={
              r.pendingEntries.length
                ? { background: '#16a34a', borderColor: '#16a34a' }
                : undefined
            }
          >
            Pay
          </Button>
        </div>
      ),
    },
  ];

  const detailColumns = [
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'd',
      width: 95,
      render: (v) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YY') : '—'}</span>,
    },
    {
      title: 'Member',
      key: 'm',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.memberName || '—'}</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>
            {r.memberRegistrationNumber ? `#${r.memberRegistrationNumber}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'sourceType',
      key: 's',
      width: 120,
      render: (v) => (
        <Tag color={v === COMMISSION_SOURCE.JOIN_FEES ? 'green' : 'blue'}>
          {SOURCE_LABEL[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Base',
      dataIndex: 'baseAmount',
      key: 'b',
      width: 90,
      align: 'right',
      render: (v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{fmtMoney(v)}</span>,
    },
    {
      title: 'Commission',
      dataIndex: 'amount',
      key: 'a',
      width: 105,
      align: 'right',
      render: (v) => (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>{fmtMoney(v)}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'st',
      width: 90,
      align: 'center',
      render: (v) => (
        <Tag color={v === COMMISSION_STATUS.PAID ? 'success' : 'error'}>
          {v === COMMISSION_STATUS.PAID ? 'Paid' : 'Pending'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <GiftOutlined style={{ color: '#b45309' }} /> Agent Commissions
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {rows.length} agents · {rangeLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={() => printAll(rows, totals, rangeLabel)}
            disabled={!rows.length || !canDo('commissions', 'export')}
            title={canDo('commissions', 'export') ? undefined : 'Export ki anumati nahi hai'}
          >
            Print / PDF
          </Button>
        </div>
      </div>

      {permError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Firestore rules commission data ko allow nahi kar rahi"
          description={
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              <code style={{ fontSize: 11 }}>
                users/{user?.uid}/agents/&lt;agentId&gt;/commissions
              </code>{' '}
              path abhi rules me cover nahi hai.
              <br />
              Fix: <code>firebase deploy --only firestore:rules</code> chalayiye
              (<code>srksf-function/</code> folder se), aur deploy ke output me
              compile error toh nahi aaya — ye zaroor dekh lijiye. Error aane par
              purani rules hi live rehti hain.
              <br />
              Detail: <code>srksf-function/FIRESTORE-COMMISSION-SETUP.md</code>
            </div>
          }
        />
      )}

      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Earned"
          value={fmtMoney(totals.earned)}
          sub={`${totals.entries} entries`}
          color={{ bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca' }}
          icon={<GiftOutlined />}
        />
        <StatCard
          label="Paid Out"
          value={fmtMoney(totals.paid)}
          color={{ bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }}
          icon={<DollarOutlined />}
        />
        <StatCard
          label="Pending Payout"
          value={fmtMoney(totals.pending)}
          sub={`${totals.agentsWithPending} agents`}
          color={{ bg: '#fff5f5', border: '#fecaca', text: '#b91c1c' }}
          icon={<DollarOutlined />}
        />
        <StatCard
          label="Join Fees"
          value={fmtMoney(totals.joinFees)}
          color={{ bg: '#fffbeb', border: '#fde68a', text: '#b45309' }}
        />
        <StatCard
          label="Closing"
          value={fmtMoney(totals.closing)}
          color={{ bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
          placeholder="Agent name / code / city"
          style={{ width: 230 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Segmented
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { label: 'Both', value: 'all' },
            { label: 'Join Fees', value: COMMISSION_SOURCE.JOIN_FEES },
            { label: 'Closing', value: COMMISSION_SOURCE.CLOSING },
          ]}
        />
        <Select
          allowClear
          placeholder="Program"
          style={{ width: 190 }}
          value={programFilter}
          onChange={setProgramFilter}
        >
          {programList.map((p) => (
            <Option key={p.id} value={p.id}>
              {p.name}
            </Option>
          ))}
        </Select>
        <RangePicker value={range} onChange={setRange} format="DD/MM/YYYY" />
        <Button
          type={onlyPending ? 'primary' : 'default'}
          danger={onlyPending}
          onClick={() => setOnlyPending((v) => !v)}
        >
          {onlyPending ? 'Showing pending only' : 'Only pending'}
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={rows}
          size="small"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 1150 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Koi commission data nahi mila"
              />
            ),
          }}
          summary={() =>
            rows.length ? (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#f9fafb', fontWeight: 700 }}>
                  <Table.Summary.Cell index={0} colSpan={4} align="right">
                    TOTAL
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <span style={{ color: '#b45309' }}>{fmtMoney(totals.joinFees)}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <span style={{ color: '#1d4ed8' }}>{fmtMoney(totals.closing)}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <span style={{ color: '#4338ca' }}>{fmtMoney(totals.earned)}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <span style={{ color: '#15803d' }}>{fmtMoney(totals.paid)}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    <span style={{ color: '#b91c1c' }}>{fmtMoney(totals.pending)}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} />
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      </Spin>

      {/* Agent detail drawer */}
      <Drawer
        open={!!detailAgent}
        onClose={() => setDetailAgent(null)}
        width={860}
        title={
          detailAgent ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {detailAgent.agent.displayName}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {detailAgent.agent.agentCode ? `#${detailAgent.agent.agentCode} · ` : ''}
                Earned {fmtMoney(detailAgent.summary.earned)} · Pending{' '}
                {fmtMoney(detailAgent.summary.pending)}
              </div>
            </div>
          ) : null
        }
        extra={
          detailAgent ? (
            <Button
              type="primary"
              icon={<DollarOutlined />}
              disabled={!detailAgent.pendingEntries.length}
              onClick={() => {
                setPayAgent(detailAgent);
                setDetailAgent(null);
              }}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
            >
              Pay {fmtMoney(detailAgent.summary.pending)}
            </Button>
          ) : null
        }
      >
        {detailAgent && (
          <Table
            size="small"
            rowKey="id"
            columns={detailColumns}
            dataSource={detailAgent.commissions}
            pagination={{ pageSize: 12, size: 'small' }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Koi entry nahi" />
              ),
            }}
          />
        )}
      </Drawer>

      {/* Payout drawer */}
      <PayCommissionDrawer
        open={!!payAgent}
        onClose={() => setPayAgent(null)}
        adminUid={user?.uid}
        agent={payAgent?.agent || {}}
        pendingCommissions={payAgent?.pendingEntries || []}
        onSuccess={load}
      />
    </div>
  );
};

export default CommissionsPage;
