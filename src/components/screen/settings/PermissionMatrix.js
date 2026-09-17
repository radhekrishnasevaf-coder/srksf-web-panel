'use client';
import React from 'react';
import { Table, Checkbox, Button, Space, Tag, Tooltip } from 'antd';
import {
  SCREENS,
  ACTION_LIST,
  ACTION_LABEL,
  ACTION_HINT,
  ACTIONS,
  normalizePermissions,
  fullPermissions,
  emptyPermissions,
  viewOnlyPermissions,
  countAllAllowed,
  totalConfigurableActions,
  actionApplies,
  actionsForScreen,
} from '@/lib/permissions';

/**
 * Screen × action ka checkbox grid.
 * Controlled — value/onChange parent ke paas.
 *
 * Rule: `view` band karne par us screen ke baaki actions bhi band ho jate
 * hain (aisa admin banane ka koi matlab nahi jo edit kar sake par screen
 * hi na khol sake). Ulta, koi bhi action on karne par `view` apne aap on.
 */
const PermissionMatrix = ({ value, onChange, disabled }) => {
  const perms = normalizePermissions(value);

  /** view band → us screen ke baaki sab band; koi action on → view on */
  const applyRowRules = (screenKey, row, action, checked) => {
    const next = { ...row, [action]: checked };
    if (action === ACTIONS.VIEW && !checked) {
      for (const a of actionsForScreen(screenKey)) {
        if (a !== ACTIONS.VIEW) next[a] = false;
      }
    } else if (action !== ACTIONS.VIEW && checked) {
      next[ACTIONS.VIEW] = true;
    }
    return next;
  };

  const setCell = (screenKey, action, checked) => {
    const next = normalizePermissions(perms);
    next[screenKey] = applyRowRules(screenKey, next[screenKey], action, checked);
    onChange?.(next);
  };

  const toggleRow = (screenKey, checked) => {
    const next = normalizePermissions(perms);
    next[screenKey] = actionsForScreen(screenKey).reduce((row, a) => {
      row[a] = checked;
      return row;
    }, {});
    onChange?.(next);
  };

  const toggleColumn = (action, checked) => {
    const next = normalizePermissions(perms);
    for (const s of SCREENS) {
      if (!actionApplies(s.key, action)) continue;
      next[s.key] = applyRowRules(s.key, next[s.key], action, checked);
    }
    onChange?.(next);
  };

  // Sirf un screens par gino jahan ye action lagu hota hai
  const screensWith = (action) => SCREENS.filter((s) => actionApplies(s.key, action));
  const columnAllChecked = (action) =>
    screensWith(action).every((s) => perms[s.key]?.[action]);
  const columnSomeChecked = (action) =>
    screensWith(action).some((s) => perms[s.key]?.[action]);

  const columns = [
    {
      title: 'Screen',
      dataIndex: 'label',
      key: 'screen',
      width: 200,
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.label}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.hi}</div>
        </div>
      ),
    },
    ...ACTION_LIST.map((action) => ({
      title: (
        <Tooltip title={ACTION_HINT[action]}>
          <div style={{ textAlign: 'center', cursor: 'help' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600 }}>{ACTION_LABEL[action]}</div>
            <Checkbox
              disabled={disabled}
              checked={columnAllChecked(action)}
              indeterminate={!columnAllChecked(action) && columnSomeChecked(action)}
              onChange={(e) => toggleColumn(action, e.target.checked)}
              style={{ marginTop: 2 }}
            />
          </div>
        </Tooltip>
      ),
      key: action,
      width: 88,
      align: 'center',
      render: (_, r) => {
        // Ye action is screen par lagu hi nahi hota
        if (!actionApplies(r.key, action)) {
          return <span style={{ color: '#d9d9d9', fontSize: 13 }}>—</span>;
        }
        return (
          <Checkbox
            disabled={disabled}
            checked={perms[r.key]?.[action] === true}
            onChange={(e) => setCell(r.key, action, e.target.checked)}
          />
        );
      },
    })),
    {
      title: <div style={{ textAlign: 'center', fontSize: 12 }}>All</div>,
      key: 'all',
      width: 62,
      align: 'center',
      fixed: 'right',
      render: (_, r) => {
        const applicable = actionsForScreen(r.key);
        const all = applicable.every((a) => perms[r.key]?.[a]);
        const some = applicable.some((a) => perms[r.key]?.[a]);
        return (
          <Checkbox
            disabled={disabled}
            checked={all}
            indeterminate={!all && some}
            onChange={(e) => toggleRow(r.key, e.target.checked)}
          />
        );
      },
    },
  ];

  const total = countAllAllowed(perms);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <Space size={6} wrap>
          <Button size="small" disabled={disabled} onClick={() => onChange?.(fullPermissions())}>
            सब चुनें
          </Button>
          <Button size="small" disabled={disabled} onClick={() => onChange?.(viewOnlyPermissions())}>
            सिर्फ़ View
          </Button>
          <Button size="small" disabled={disabled} onClick={() => onChange?.(emptyPermissions())}>
            सब हटाएँ
          </Button>
        </Space>
        <Tooltip title="Kitne actions allow kiye gaye hain">
          <Tag color={total === 0 ? 'default' : 'blue'}>
            {total} / {totalConfigurableActions()} allowed
          </Tag>
        </Tooltip>
      </div>

      <Table
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={SCREENS}
        pagination={false}
        bordered
        scroll={{ x: 900 }}
      />

      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, lineHeight: 1.7 }}>
        <strong>View</strong> band karne par us screen ke baaki actions apne aap band ho
        jate hain — screen hi nahi khulegi toh edit/delete ka koi matlab nahi.
        Isi tarah koi action on karne par <strong>View</strong> apne aap on ho jata hai.
        <br />
        <strong>—</strong> ka matlab wo action us screen par lagu hi nahi hota
        (jaise Dashboard par Delete). Column ke naam par hover karke uska matlab dekh sakte hain.
      </div>
    </div>
  );
};

export default PermissionMatrix;
