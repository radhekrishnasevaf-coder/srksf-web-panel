"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Button, Drawer, Form, Input, Table, Tag, Tooltip, Popconfirm, Select,
  App, Empty, Spin, Switch, Divider, Alert, Avatar, Space, Modal, Typography,
} from 'antd';
import {
  UserAddOutlined, EditOutlined, DeleteOutlined, KeyOutlined, UserOutlined,
  ReloadOutlined, SafetyCertificateOutlined, MailOutlined, PhoneOutlined,
  LockOutlined, CloseOutlined,
} from '@ant-design/icons';
import { auth, db } from '@/lib/firebase';
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthProvider';
import dayjs from 'dayjs';
import PermissionMatrix from './PermissionMatrix';
import {
  ROLES, ROLE_LABEL, SCREENS, ACTION_LIST,
  emptyPermissions, viewOnlyPermissions, normalizePermissions,
  countAllAllowed,
} from '@/lib/permissions';

const { Text } = Typography;

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
  return Array(12).fill().map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

const TeamMembers = () => {
  const { user, isSuperAdmin } = useAuth();
  const { message, modal } = App.useApp();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);      // team member doc, ya null = naya
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const ownerUid = user?.ownerUid || user?.uid;

  /* ── Load ──────────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!ownerUid || !isSuperAdmin) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', ownerUid, 'teamMembers'));
      setMembers(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => m.delete_flag !== true)
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      );
    } catch (err) {
      console.error(err);
      message.error('Team members load nahi ho paye');
    } finally {
      setLoading(false);
    }
  }, [ownerUid, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  /* ── Drawer open/close ─────────────────────────────────────────────────── */
  const openCreate = () => {
    setEditing(null);
    setPermissions(viewOnlyPermissions());
    form.resetFields();
    form.setFieldsValue({ password: generatePassword(), status: 'active' });
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setPermissions(normalizePermissions(record.permissions));
    form.resetFields();
    form.setFieldsValue({
      displayName: record.displayName || '',
      email: record.email || '',
      phone: record.phone || '',
      status: record.status || 'active',
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    form.resetFields();
  };

  /* ── Create / update ───────────────────────────────────────────────────── */
  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editing) {
        // ── Update ──
        const patch = {
          displayName: values.displayName || '',
          phone: values.phone || '',
          status: values.status || 'active',
          permissions,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.authUid || null,
        };
        await updateDoc(doc(db, 'users', ownerUid, 'teamMembers', editing.id), patch);
        // user doc bhi sync rakho (AuthProvider isko padhta hai)
        await setDoc(
          doc(db, 'users', editing.id),
          {
            displayName: patch.displayName,
            phone: patch.phone,
            status: patch.status,
            role: ROLES.ADMIN,
            ownerUid,
            updatedAt: patch.updatedAt,
          },
          { merge: true }
        );
        message.success('Team member update ho gaya');
      } else {
        // ── Create ──
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Login session nahi mila');
        const token = await currentUser.getIdToken();

        const res = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'create',
            email: values.email,
            password: values.password,
            OrgData: { role: ROLES.ADMIN, displayName: values.displayName, ownerUid, createdBy: user?.authUid },
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Account nahi ban paya');

        const newUid = data.user.uid;
        const now = new Date().toISOString();

        const teamDoc = {
          uid: newUid,
          authUid: newUid,
          ownerUid,
          email: values.email,
          displayName: values.displayName || '',
          phone: values.phone || '',
          role: ROLES.ADMIN,
          status: values.status || 'active',
          permissions,
          createdAt: now,
          createdBy: user?.authUid || null,
          delete_flag: false,
        };

        // Owner ke tree me team member doc
        await setDoc(doc(db, 'users', ownerUid, 'teamMembers', newUid), teamDoc);
        // Aur uska apna user doc — AuthProvider login par isi se ownerUid nikalta hai
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          ownerUid,
          email: values.email,
          displayName: values.displayName || '',
          phone: values.phone || '',
          role: ROLES.ADMIN,
          status: values.status || 'active',
          createdAt: now,
          createdBy: user?.authUid || null,
        });

        modal.success({
          title: 'Admin account ban gaya',
          width: 460,
          content: (
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <div>Ye login details is vyakti ko de dijiye:</div>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '10px 14px', marginTop: 8 }}>
                <div>Email: <Text strong copyable>{values.email}</Text></div>
                <div>Password: <Text strong copyable>{values.password}</Text></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                Password dobara nahi dikhaya jayega — abhi copy kar lijiye.
              </div>
            </div>
          ),
        });
      }

      closeDrawer();
      load();
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Save nahi ho paya');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Status toggle ─────────────────────────────────────────────────────── */
  const toggleStatus = async (record) => {
    const next = record.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', ownerUid, 'teamMembers', record.id), {
        status: next,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'users', record.id), { status: next }, { merge: true });
      message.success(next === 'active' ? 'Account chalu kar diya' : 'Account band kar diya');
      load();
    } catch (err) {
      console.error(err);
      message.error('Status badal nahi paya');
    }
  };

  /* ── Reset password ────────────────────────────────────────────────────── */
  const resetPassword = async (record) => {
    const newPassword = generatePassword();
    try {
      const currentUser = auth.currentUser;
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'updatePassword', uid: record.id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset nahi hua');

      modal.success({
        title: 'Naya password ban gaya',
        content: (
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div>{record.displayName} ({record.email})</div>
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '10px 14px', marginTop: 8 }}>
              Password: <Text strong copyable>{newPassword}</Text>
            </div>
          </div>
        ),
      });
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Password reset nahi ho paya');
    }
  };

  /* ── Delete ────────────────────────────────────────────────────────────── */
  const handleDelete = async (record) => {
    try {
      const currentUser = auth.currentUser;
      const token = await currentUser.getIdToken();

      await deleteDoc(doc(db, 'users', ownerUid, 'teamMembers', record.id));
      await setDoc(doc(db, 'users', record.id), {
        status: 'inactive',
        delete_flag: true,
        deletedAt: new Date().toISOString(),
      }, { merge: true });

      // Firebase Auth account bhi hata do
      try {
        await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'delete', uid: record.id }),
        });
      } catch (authErr) {
        console.log('Auth delete error (may not exist):', authErr);
      }

      message.success(`${record.displayName} ko hata diya gaya`);
      load();
    } catch (err) {
      console.error(err);
      message.error('Delete nahi ho paya');
    }
  };

  /* ── Columns ───────────────────────────────────────────────────────────── */
  const columns = [
    {
      title: 'Member',
      key: 'member',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar icon={<UserOutlined />} style={{ background: '#78350f' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.displayName || '—'}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</span>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (v) => <Tag color="blue">{ROLE_LABEL[v] || 'Admin'}</Tag>,
    },
    {
      title: 'Access',
      key: 'access',
      width: 190,
      render: (_, r) => {
        const perms = normalizePermissions(r.permissions);
        const visible = SCREENS.filter((s) => perms[s.key].view);
        const total = countAllAllowed(perms);
        if (!visible.length) {
          return <Tag color="error">कोई access नहीं</Tag>;
        }
        return (
          <Tooltip
            title={
              <div style={{ fontSize: 11 }}>
                {visible.map((s) => (
                  <div key={s.key}>
                    {s.label}: {ACTION_LIST.filter((a) => perms[s.key][a]).join(', ')}
                  </div>
                ))}
              </div>
            }
          >
            <span style={{ cursor: 'help' }}>
              <Tag color="green">{visible.length} screens</Tag>
              <Tag>{total} actions</Tag>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v, r) => (
        <Switch
          size="small"
          checked={v === 'active'}
          checkedChildren="Active"
          unCheckedChildren="Off"
          onChange={() => toggleStatus(r)}
        />
      ),
    },
    {
      title: 'Added',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (v) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {v ? dayjs(v).format('DD/MM/YY') : '—'}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 130,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Permissions badlein">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Naya password">
            <Popconfirm
              title="Naya password banayein?"
              description="Purana password kaam karna band kar dega."
              okText="Haan"
              cancelText="Nahi"
              onConfirm={() => resetPassword(r)}
            >
              <Button size="small" icon={<KeyOutlined />} />
            </Popconfirm>
          </Tooltip>
          <Tooltip title="Hatayein">
            <Popconfirm
              title="Is admin ko hata dein?"
              description="Iska login account bhi delete ho jayega."
              okText="Haan, hatayein"
              okButtonProps={{ danger: true }}
              cancelText="Nahi"
              onConfirm={() => handleDelete(r)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  /* ── Sirf super admin ──────────────────────────────────────────────────── */
  if (!isSuperAdmin) {
    return (
      <Card className="rounded-lg">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ fontWeight: 600, color: '#374151' }}>Sirf Super Admin</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                Team members sirf super admin manage kar sakta hai.
              </div>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <Card
      className="rounded-lg"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyCertificateOutlined style={{ color: '#78350f' }} />
          Team Members &amp; Access
        </span>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} size="small">
            Refresh
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate} className="!bg-amber-900">
            ADD ADMIN
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 14 }}
        message="Admin sirf wahi screens dekh payega jo aap yahan allow karenge"
        description="Admin ko aapka hi data dikhega (wahi members, agents, payments). Super admin ke paas hamesha poora access rehta hai aur wo badla nahi ja sakta."
      />

      <Spin spinning={loading}>
        <Table
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={members}
          pagination={{ pageSize: 10, size: 'small' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Abhi koi admin nahi — ADD ADMIN se banayein"
              />
            ),
          }}
        />
      </Spin>

      {/* ── Create / Edit drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        width={780}
        maskClosable={false}
        destroyOnHidden
        title={
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {editing ? 'Admin edit karein' : 'Naya admin banayein'}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {editing ? editing.email : 'Login account banega aur access aap tay karenge'}
            </div>
          </div>
        }
        extra={<Button type="text" icon={<CloseOutlined />} onClick={closeDrawer} />}
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={closeDrawer} style={{ flex: 1 }} disabled={submitting}>
              रद्द करें
            </Button>
            <Button
              type="primary"
              style={{ flex: 2 }}
              loading={submitting}
              onClick={() => form.submit()}
            >
              {editing ? 'Update करें' : 'Admin बनाएँ'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              name="displayName"
              label="पूरा नाम"
              rules={[{ required: true, message: 'नाम डालें' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="नाम" size="large" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email (यही login ID होगी)"
              rules={[
                { required: true, message: 'Email डालें' },
                { type: 'email', message: 'सही email डालें' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="admin@example.com"
                size="large"
                disabled={!!editing}
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label="फ़ोन (वैकल्पिक)"
              rules={[{ pattern: /^[0-9]{10}$/, message: '10 अंकों का नंबर' }]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="10 अंक" size="large" maxLength={10} />
            </Form.Item>

            <Form.Item name="status" label="Status">
              <Select size="large">
                <Select.Option value="active">Active — login कर सकेगा</Select.Option>
                <Select.Option value="inactive">Inactive — login बंद</Select.Option>
              </Select>
            </Form.Item>
          </div>

          {!editing && (
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Password डालें' },
                { min: 6, message: 'कम से कम 6 अक्षर' },
              ]}
              extra="बनाने के बाद एक बार दिखेगा — तभी copy कर लीजिए।"
            >
              <Input
                prefix={<LockOutlined />}
                size="large"
                addonAfter={
                  <a onClick={() => form.setFieldsValue({ password: generatePassword() })}>
                    नया बनाएँ
                  </a>
                }
              />
            </Form.Item>
          )}
        </Form>

        <Divider orientation="left" style={{ marginTop: 8 }}>
          Screen Access
        </Divider>

        <PermissionMatrix value={permissions} onChange={setPermissions} />
      </Drawer>
    </Card>
  );
};

export default TeamMembers;
