'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Button, Segmented, Select, DatePicker, Empty, Spin, App,
  Tabs, Popconfirm, Tooltip, Input, Alert,
} from 'antd';
import {
  ReloadOutlined, PrinterOutlined, DollarOutlined, HistoryOutlined,
  GiftOutlined, UndoOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useAuth } from '@/lib/AuthProvider';
import {
  getAgentCommissions,
  getAgentPayouts,
  revertPayout,
  summarizeCommissions,
  getCommissionConfig,
  rateLabel,
  fmtMoney,
  toNum,
  COMMISSION_SOURCE,
  COMMISSION_STATUS,
  SOURCE_LABEL,
} from '@/lib/services/commissionService';
import PayCommissionDrawer from './PayCommissionDrawer';
import { useCan } from '@/components/base/Can';
import { TrsutData } from '@/lib/constentData';

const { RangePicker } = DatePicker;
const { Option } = Select;

/* ── Summary card ──────────────────────────────────────────────────────── */
const Card = ({ label, value, sub, color }) => (
  <div
    style={{
      flex: 1,
      minWidth: 150,
      background: color.bg,
      border: `1px solid ${color.border}`,
      borderRadius: 10,
      padding: '11px 14px',
    }}
  >
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
    <div style={{ fontSize: 20, fontWeight: 800, color: color.text, lineHeight: 1.2, marginTop: 3 }}>
      {value}
    </div>
    {sub ? <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div> : null}
  </div>
);

/* ── Print statement ───────────────────────────────────────────────────── */
const printStatement = ({ agent, commissions, payouts, summary, rangeLabel }) => {
  const rows = commissions
    .map(
      (c, i) => `
    <tr class="${i % 2 ? 'alt' : ''}">
      <td class="center">${i + 1}</td>
      <td class="center">${c.paymentDate ? dayjs(c.paymentDate).format('DD/MM/YYYY') : '-'}</td>
      <td>${c.memberName || '-'}<div class="sub">${c.memberRegistrationNumber || ''}</div></td>
      <td class="center">${SOURCE_LABEL[c.sourceType] || c.sourceType}</td>
      <td class="right">&#8377;${toNum(c.baseAmount).toLocaleString('en-IN')}</td>
      <td class="center">${c.commissionType === 'fixed' ? 'Fixed' : `${toNum(c.commissionRate)}%`}</td>
      <td class="right amt">&#8377;${toNum(c.amount).toLocaleString('en-IN')}</td>
      <td class="center"><span class="badge ${c.status}">${c.status}</span></td>
    </tr>`
    )
    .join('');

  const payoutRows = payouts
    .map(
      (p, i) => `
    <tr class="${i % 2 ? 'alt' : ''}">
      <td class="center">${i + 1}</td>
      <td class="mono">${p.payoutNumber || '-'}</td>
      <td class="center">${p.payoutDate ? dayjs(p.payoutDate).format('DD/MM/YYYY') : '-'}</td>
      <td class="center">${p.paymentMode === 'cash' ? 'Cash' : 'Online'}</td>
      <td class="center">${p.commissionCount || 0}</td>
      <td class="right amt">&#8377;${toNum(p.amount).toLocaleString('en-IN')}</td>
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Commission Statement</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1a1a2e}
  .page{width:210mm;min-height:297mm;padding:13mm;margin:0 auto;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:9pt;border-bottom:2pt solid #1d2a4a;margin-bottom:11pt}
  .brand{font-size:14pt;font-weight:700;color:#1d2a4a}
  .brand-sub{font-size:8.5pt;color:#6b7280;margin-top:2pt}
  .meta{text-align:right;font-size:8.5pt;color:#374151}
  .meta b{display:block;font-size:7pt;letter-spacing:.5pt;text-transform:uppercase;color:#9ca3af}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6pt;margin-bottom:12pt}
  .card{border:.75pt solid #e2e8f0;border-radius:5pt;padding:7pt 9pt;background:#f8fafc}
  .card-label{font-size:6.5pt;font-weight:700;letter-spacing:.6pt;text-transform:uppercase;color:#94a3b8}
  .card-value{font-size:12pt;font-weight:800;margin-top:2pt}
  .c-earn .card-value{color:#1d2a4a}.c-paid .card-value{color:#16a34a}
  .c-pend .card-value{color:#dc2626}.c-cnt .card-value{color:#7c3aed}
  h3{font-size:9.5pt;color:#1d2a4a;margin:11pt 0 5pt;text-transform:uppercase;letter-spacing:.5pt}
  table{width:100%;border-collapse:collapse;font-size:8.5pt}
  thead tr{background:#1d2a4a}
  thead th{color:#fff;font-size:7pt;font-weight:700;padding:5pt;text-align:left;letter-spacing:.4pt}
  tbody td{padding:4pt 5pt;border-bottom:.5pt solid #f1f5f9;vertical-align:middle}
  tbody tr.alt td{background:#f8fafc}
  .center{text-align:center}.right{text-align:right}
  .amt{font-weight:700;color:#b45309}
  .sub{font-size:7pt;color:#94a3b8;font-family:'Courier New',monospace}
  .mono{font-family:'Courier New',monospace;font-size:7.5pt;color:#64748b}
  .badge{display:inline-block;padding:1.5pt 5pt;border-radius:20pt;font-size:6.5pt;font-weight:700;text-transform:uppercase}
  .badge.paid{background:#d1fae5;color:#065f46}
  .badge.pending{background:#fee2e2;color:#991b1b}
  .foot{margin-top:14pt;padding-top:7pt;border-top:.75pt solid #e2e8f0;display:flex;justify-content:space-between;font-size:7.5pt;color:#94a3b8}
  @media print{.page{padding:10mm}}
</style></head><body><div class="page">
  <div class="header">
    <div>
      <div class="brand">${TrsutData?.name || 'Commission Statement'}</div>
      <div class="brand-sub">Agent Commission Statement</div>
    </div>
    <div class="meta">
      <b>Agent</b>${agent?.displayName || '-'} ${agent?.agentCode ? `(${agent.agentCode})` : ''}
      <b style="margin-top:4pt">Period</b>${rangeLabel}
      <b style="margin-top:4pt">Generated</b>${dayjs().format('DD MMM YYYY, hh:mm A')}
    </div>
  </div>

  <div class="summary">
    <div class="card c-earn"><div class="card-label">Total Earned</div><div class="card-value">&#8377;${summary.earned.toLocaleString('en-IN')}</div></div>
    <div class="card c-paid"><div class="card-label">Paid Out</div><div class="card-value">&#8377;${summary.paid.toLocaleString('en-IN')}</div></div>
    <div class="card c-pend"><div class="card-label">Pending</div><div class="card-value">&#8377;${summary.pending.toLocaleString('en-IN')}</div></div>
    <div class="card c-cnt"><div class="card-label">Entries</div><div class="card-value">${summary.total}</div></div>
  </div>

  <h3>Commission Entries</h3>
  <table>
    <thead><tr>
      <th class="center">#</th><th class="center">Date</th><th>Member</th>
      <th class="center">Source</th><th class="right">Base</th>
      <th class="center">Rate</th><th class="right">Commission</th><th class="center">Status</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="center">No entries</td></tr>'}</tbody>
  </table>

  <h3>Payout History</h3>
  <table>
    <thead><tr>
      <th class="center">#</th><th>Payout No.</th><th class="center">Date</th>
      <th class="center">Mode</th><th class="center">Entries</th><th class="right">Amount</th>
    </tr></thead>
    <tbody>${payoutRows || '<tr><td colspan="6" class="center">No payouts</td></tr>'}</tbody>
  </table>

  <div class="foot">
    <span>Agent: ${agent?.displayName || '-'}</span>
    <span>Authorised Signatory</span>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
};

/* ── Main ──────────────────────────────────────────────────────────────── */
const AgentCommission = ({ agentId, agentInfo }) => {
  const { user } = useAuth();
  const { message } = App.useApp();
  const canDo = useCan();
  const programList = useSelector((state) => state.data.programList) || [];

  const [commissions, setCommissions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState(null);
  const [range, setRange] = useState(null);
  const [search, setSearch] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [permError, setPermError] = useState(false);

  const config = useMemo(() => getCommissionConfig(agentInfo), [agentInfo]);

  const load = useCallback(async () => {
    if (!user?.uid || !agentId) return;
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        getAgentCommissions(user.uid, agentId),
        getAgentPayouts(user.uid, agentId),
      ]);
      setCommissions(c);
      setPayouts(p);
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
  }, [user?.uid, agentId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Filters */
  const filtered = useMemo(() => {
    let list = commissions;
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    if (sourceFilter !== 'all') list = list.filter((c) => c.sourceType === sourceFilter);
    if (programFilter) list = list.filter((c) => c.programId === programFilter);
    if (range?.[0] && range?.[1]) {
      const s = range[0].startOf('day').valueOf();
      const e = range[1].endOf('day').valueOf();
      list = list.filter((c) => {
        const t = new Date(c.paymentDate || c.createdAt || 0).valueOf();
        return t >= s && t <= e;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.memberName?.toLowerCase().includes(q) ||
          c.memberRegistrationNumber?.toLowerCase().includes(q) ||
          c.closingMemberName?.toLowerCase().includes(q) ||
          c.payoutNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [commissions, statusFilter, sourceFilter, programFilter, range, search]);

  const summary = useMemo(() => summarizeCommissions(filtered), [filtered]);
  const allTimeSummary = useMemo(() => summarizeCommissions(commissions), [commissions]);

  const pendingEntries = useMemo(
    () => commissions.filter((c) => c.status !== COMMISSION_STATUS.PAID),
    [commissions]
  );

  const rangeLabel =
    range?.[0] && range?.[1]
      ? `${range[0].format('DD MMM YYYY')} – ${range[1].format('DD MMM YYYY')}`
      : 'All time';

  const handleRevert = async (payout) => {
    try {
      await revertPayout(user.uid, agentId, payout);
      message.success('Payout revert ho gaya — entries wapas pending hain');
      load();
    } catch (err) {
      console.error(err);
      message.error('Revert failed');
    }
  };

  /* Columns */
  const commissionColumns = [
    {
      title: '#',
      key: 'i',
      width: 44,
      align: 'center',
      render: (_, __, i) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{i + 1}</span>,
    },
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'date',
      width: 95,
      sorter: (a, b) => new Date(a.paymentDate || 0) - new Date(b.paymentDate || 0),
      render: (v) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YY') : '—'}</span>,
    },
    {
      title: 'Member',
      key: 'member',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.memberName || '—'}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {r.memberRegistrationNumber ? `#${r.memberRegistrationNumber}` : ''}
            {r.closingMemberName ? ` → ${r.closingMemberName}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'sourceType',
      key: 'source',
      width: 130,
      filters: [
        { text: 'Join Fees', value: COMMISSION_SOURCE.JOIN_FEES },
        { text: 'Closing Payment', value: COMMISSION_SOURCE.CLOSING },
      ],
      onFilter: (v, r) => r.sourceType === v,
      render: (v) => (
        <Tag color={v === COMMISSION_SOURCE.JOIN_FEES ? 'green' : 'blue'}>
          {SOURCE_LABEL[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Program',
      dataIndex: 'programName',
      key: 'program',
      width: 130,
      render: (v) => <span style={{ fontSize: 11, color: '#6b7280' }}>{v || '—'}</span>,
    },
    {
      title: 'Base amount',
      dataIndex: 'baseAmount',
      key: 'base',
      width: 105,
      align: 'right',
      render: (v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{fmtMoney(v)}</span>,
    },
    {
      title: 'Rate',
      key: 'rate',
      width: 80,
      align: 'center',
      render: (_, r) => (
        <Tooltip title={r.isCustomAmount ? 'Custom amount diya gaya tha' : 'Agent ki default rate'}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {rateLabel(r.commissionType, r.commissionRate)}
            {r.isCustomAmount ? ' *' : ''}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Commission',
      dataIndex: 'amount',
      key: 'amount',
      width: 115,
      align: 'right',
      sorter: (a, b) => toNum(a.amount) - toNum(b.amount),
      render: (v) => (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>{fmtMoney(v)}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (v, r) => (
        <Tooltip title={r.payoutNumber ? `Payout: ${r.payoutNumber}` : ''}>
          <Tag color={v === COMMISSION_STATUS.PAID ? 'success' : 'error'}>
            {v === COMMISSION_STATUS.PAID ? 'Paid' : 'Pending'}
          </Tag>
        </Tooltip>
      ),
    },
  ];

  const payoutColumns = [
    {
      title: '#',
      key: 'i',
      width: 44,
      align: 'center',
      render: (_, __, i) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{i + 1}</span>,
    },
    {
      title: 'Payout No.',
      dataIndex: 'payoutNumber',
      key: 'no',
      width: 210,
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{v || '—'}</span>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'payoutDate',
      key: 'date',
      width: 100,
      render: (v) => <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YY') : '—'}</span>,
    },
    {
      title: 'Mode',
      dataIndex: 'paymentMode',
      key: 'mode',
      width: 90,
      align: 'center',
      render: (v, r) => (
        <Tooltip title={r.transactionId ? `TXN: ${r.transactionId}` : ''}>
          <Tag color={v === 'cash' ? 'gold' : 'purple'}>{v === 'cash' ? 'Cash' : 'Online'}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Entries',
      dataIndex: 'commissionCount',
      key: 'cnt',
      width: 80,
      align: 'center',
      render: (v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || 0}</span>,
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      render: (v) => <span style={{ fontSize: 11, color: '#9ca3af' }}>{v || '—'}</span>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amt',
      width: 115,
      align: 'right',
      render: (v) => (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{fmtMoney(v)}</span>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 60,
      align: 'center',
      render: (_, r) => (
        <Popconfirm
          title="Payout revert karein?"
          description="Isse ye entries wapas pending ho jayengi."
          okText="Haan"
          cancelText="Nahi"
          disabled={!canDo('commissions', 'delete')}
          onConfirm={() => handleRevert(r)}
        >
          <Button
            type="text" danger size="small" icon={<UndoOutlined />}
            disabled={!canDo('commissions', 'delete')}
          />
        </Popconfirm>
      ),
    },
  ];

  if (permError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Firestore rules commission data ko allow nahi kar rahi"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6 }}>
              Ye path abhi rules me cover nahi hai:
              <br />
              <code style={{ fontSize: 11 }}>
                users/{user?.uid}/agents/{agentId}/commissions
              </code>
            </div>
            <div>
              Fix: <code>srksf-function/firestore.rules</code> deploy kijiye —
              <code style={{ marginLeft: 4 }}>firebase deploy --only firestore:rules</code>
              <br />
              Deploy ke output me compile error toh nahi aaya, ye zaroor dekh lijiye —
              error aane par purani rules hi live rehti hain.
              <br />
              Poori detail: <code>srksf-function/FIRESTORE-COMMISSION-SETUP.md</code>
            </div>
          </div>
        }
      />
    );
  }

  if (!config.enabled) {
    return (
      <div style={{ padding: '40px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ fontWeight: 600, color: '#374151' }}>
                Is agent ke liye commission band hai
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Agent edit karke "Commission Settings" me enable karein.
              </div>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <GiftOutlined style={{ color: '#b45309' }} /> Commission
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Join fees {config.joinFees.enabled ? rateLabel(config.joinFees.type, config.joinFees.value) : 'off'}
            {' · '}
            Closing {config.closing.enabled ? rateLabel(config.closing.type, config.closing.value) : 'off'}
            {' · '}{rangeLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() =>
              printStatement({ agent: agentInfo, commissions: filtered, payouts, summary, rangeLabel })
            }
            disabled={(!filtered.length && !payouts.length) || !canDo('commissions', 'export')}
            title={canDo('commissions', 'export') ? undefined : 'Export ki anumati nahi hai'}
          >
            Print / PDF
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<DollarOutlined />}
            onClick={() => setPayOpen(true)}
            disabled={!pendingEntries.length || !canDo('commissions', 'create')}
            title={canDo('commissions', 'create') ? undefined : 'Commission pay karne ki anumati nahi hai'}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            Pay Commission ({fmtMoney(allTimeSummary.pending)})
          </Button>
        </div>
      </div>

      {/* ── Summary ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Card
          label="Total Earned"
          value={fmtMoney(summary.earned)}
          sub={`${summary.total} entries`}
          color={{ bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca' }}
        />
        <Card
          label="Paid Out"
          value={fmtMoney(summary.paid)}
          sub={`${summary.paidCount} entries`}
          color={{ bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }}
        />
        <Card
          label="Pending"
          value={fmtMoney(summary.pending)}
          sub={`${summary.pendingCount} entries`}
          color={{ bg: '#fff5f5', border: '#fecaca', text: '#b91c1c' }}
        />
        <Card
          label="Join Fees"
          value={fmtMoney(summary.joinFeesAmount)}
          color={{ bg: '#fffbeb', border: '#fde68a', text: '#b45309' }}
        />
        <Card
          label="Closing"
          value={fmtMoney(summary.closingAmount)}
          color={{ bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }}
        />
      </div>

      <Tabs
        size="small"
        defaultActiveKey="entries"
        items={[
          {
            key: 'entries',
            label: (
              <span>
                <GiftOutlined /> Commission Entries ({filtered.length})
              </span>
            ),
            children: (
              <>
                {/* Filters */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <Segmented
                    size="small"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { label: 'All', value: 'all' },
                      { label: 'Pending', value: COMMISSION_STATUS.PENDING },
                      { label: 'Paid', value: COMMISSION_STATUS.PAID },
                    ]}
                  />
                  <Segmented
                    size="small"
                    value={sourceFilter}
                    onChange={setSourceFilter}
                    options={[
                      { label: 'Both', value: 'all' },
                      { label: 'Join Fees', value: COMMISSION_SOURCE.JOIN_FEES },
                      { label: 'Closing', value: COMMISSION_SOURCE.CLOSING },
                    ]}
                  />
                  <Select
                    size="small"
                    allowClear
                    placeholder="Program"
                    style={{ width: 170 }}
                    value={programFilter}
                    onChange={setProgramFilter}
                  >
                    {programList.map((p) => (
                      <Option key={p.id} value={p.id}>
                        {p.name}
                      </Option>
                    ))}
                  </Select>
                  <RangePicker size="small" value={range} onChange={setRange} format="DD/MM/YYYY" />
                  <Input
                    size="small"
                    allowClear
                    prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                    placeholder="Member / reg no."
                    style={{ width: 180 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <Spin spinning={loading}>
                  <Table
                    size="small"
                    rowKey="id"
                    columns={commissionColumns}
                    dataSource={filtered}
                    pagination={{ pageSize: 12, size: 'small', showSizeChanger: true }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Abhi koi commission entry nahi"
                        />
                      ),
                    }}
                    summary={(data) => {
                      const t = data.reduce((s, r) => s + toNum(r.amount), 0);
                      if (!data.length) return null;
                      return (
                        <Table.Summary.Row style={{ background: '#fffbeb' }}>
                          <Table.Summary.Cell index={0} colSpan={7} align="right">
                            <strong>Page total</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={7} align="right">
                            <strong style={{ color: '#b45309' }}>{fmtMoney(t)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={8} />
                        </Table.Summary.Row>
                      );
                    }}
                  />
                </Spin>
              </>
            ),
          },
          {
            key: 'payouts',
            label: (
              <span>
                <HistoryOutlined /> Payout History ({payouts.length})
              </span>
            ),
            children: (
              <Spin spinning={loading}>
                <Table
                  size="small"
                  rowKey="id"
                  columns={payoutColumns}
                  dataSource={payouts}
                  pagination={{ pageSize: 10, size: 'small' }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Abhi tak koi commission payout nahi hua"
                      />
                    ),
                  }}
                />
              </Spin>
            ),
          },
        ]}
      />

      <PayCommissionDrawer
        open={payOpen}
        onClose={() => setPayOpen(false)}
        adminUid={user?.uid}
        agent={agentInfo ? { ...agentInfo, id: agentId } : { id: agentId }}
        pendingCommissions={pendingEntries}
        onSuccess={load}
      />
    </div>
  );
};

export default AgentCommission;
