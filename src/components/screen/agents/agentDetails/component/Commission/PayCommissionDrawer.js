'use client';
import React, { useMemo, useState, useEffect } from 'react';
import {
  Drawer, Button, Form, Select, DatePicker, Input, Table, Tag, Alert, App, Checkbox,
} from 'antd';
import {
  CheckCircleOutlined, WalletOutlined, BankOutlined, QrcodeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  payAgentCommission,
  fmtMoney,
  toNum,
  SOURCE_LABEL,
} from '@/lib/services/commissionService';

const { Option } = Select;
const { TextArea } = Input;

/**
 * Agent ko pending commission ka paisa dene ka drawer.
 * Selected entries hi paid mark hoti hain.
 */
const PayCommissionDrawer = ({
  open, onClose, adminUid, agent, pendingCommissions = [], onSuccess,
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [mode, setMode] = useState('cash');

  useEffect(() => {
    if (!open) return;
    setSelectedIds(pendingCommissions.map((c) => c.id));
    setMode('cash');
    form.resetFields();
    form.setFieldsValue({ payoutDate: dayjs(), paymentMode: 'cash' });
  }, [open, pendingCommissions.length]);

  const selectedTotal = useMemo(
    () =>
      pendingCommissions
        .filter((c) => selectedIds.includes(c.id))
        .reduce((s, c) => s + toNum(c.amount), 0),
    [selectedIds, pendingCommissions]
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedIds.length) {
        message.warning('Kam se kam ek commission entry select karein');
        return;
      }
      setSubmitting(true);
      const res = await payAgentCommission(adminUid, agent.id, {
        agentName: agent.displayName || '',
        agentCode: agent.agentCode || '',
        amount: selectedTotal,
        paymentMode: values.paymentMode,
        transactionId: values.transactionId || null,
        note: values.note || '',
        payoutDate: values.payoutDate?.toDate() || new Date(),
        commissionIds: selectedIds,
        createdBy: adminUid,
      });
      message.success(`${fmtMoney(res.amount)} commission paid · ${res.payoutNumber}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err?.errorFields) return;
      console.error(err);
      message.error(err.message || 'Payout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: (
        <Checkbox
          checked={selectedIds.length === pendingCommissions.length && pendingCommissions.length > 0}
          indeterminate={selectedIds.length > 0 && selectedIds.length < pendingCommissions.length}
          onChange={(e) =>
            setSelectedIds(e.target.checked ? pendingCommissions.map((c) => c.id) : [])
          }
        />
      ),
      key: 'sel',
      width: 42,
      render: (_, r) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onChange={() =>
            setSelectedIds((prev) =>
              prev.includes(r.id) ? prev.filter((i) => i !== r.id) : [...prev, r.id]
            )
          }
        />
      ),
    },
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'date',
      width: 92,
      render: (v) => (
        <span style={{ fontSize: 12 }}>{v ? dayjs(v).format('DD/MM/YY') : '—'}</span>
      ),
    },
    {
      title: 'Member',
      key: 'member',
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
      key: 'source',
      width: 120,
      render: (v) => (
        <Tag color={v === 'joinFees' ? 'green' : 'blue'} style={{ fontSize: 10 }}>
          {SOURCE_LABEL[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Base',
      dataIndex: 'baseAmount',
      key: 'base',
      width: 90,
      align: 'right',
      render: (v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{fmtMoney(v)}</span>,
    },
    {
      title: 'Commission',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      align: 'right',
      render: (v) => (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>{fmtMoney(v)}</span>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      title={
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Pay Commission</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {agent?.displayName} {agent?.agentCode ? `· ${agent.agentCode}` : ''}
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={onClose} style={{ flex: 1, height: 40 }}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            icon={<CheckCircleOutlined />}
            disabled={!selectedIds.length}
            style={{ flex: 2, height: 40, background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }}
          >
            Pay {fmtMoney(selectedTotal)} ({selectedIds.length})
          </Button>
        </div>
      }
    >
      {!pendingCommissions.length ? (
        <Alert
          type="success"
          showIcon
          message="Koi pending commission nahi"
          description="Is agent ka saara commission already pay ho chuka hai."
        />
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 14 }}
            message={`${pendingCommissions.length} pending entries · Total ${fmtMoney(
              pendingCommissions.reduce((s, c) => s + toNum(c.amount), 0)
            )}`}
            description="Jo entries pay karni hain wahi select rakhein. Payout ke baad ye entries 'paid' ho jayengi."
          />

          <Table
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={pendingCommissions}
            pagination={{ pageSize: 8, size: 'small' }}
            style={{ marginBottom: 18 }}
          />

          <Form form={form} layout="vertical" requiredMark={false}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item
                name="payoutDate"
                label="Payout date"
                rules={[{ required: true, message: 'Required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item
                name="paymentMode"
                label="Payment mode"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select onChange={setMode}>
                  <Option value="cash">
                    <WalletOutlined /> Cash
                  </Option>
                  <Option value="online">
                    <BankOutlined /> Online / UPI
                  </Option>
                </Select>
              </Form.Item>
            </div>

            {mode === 'online' && (
              <Form.Item
                name="transactionId"
                label="Transaction ID / UTR"
                rules={[{ required: true, message: 'Please enter transaction ID' }]}
              >
                <Input prefix={<QrcodeOutlined />} placeholder="UTR / Transaction ID" />
              </Form.Item>
            )}

            <Form.Item name="note" label="Note (optional)">
              <TextArea rows={2} placeholder="Payout ke baare me koi remark…" maxLength={300} showCount />
            </Form.Item>
          </Form>
        </>
      )}
    </Drawer>
  );
};

export default PayCommissionDrawer;
