'use client';
import React from 'react';
import { Card, Form, Switch, Select, InputNumber, Alert, Divider } from 'antd';
import { PercentageOutlined, DollarOutlined, GiftOutlined } from '@ant-design/icons';
import {
  COMMISSION_TYPE,
  DEFAULT_COMMISSION_PERCENT,
} from '@/lib/services/commissionService';

const { Option } = Select;

/**
 * Agent Add/Edit drawer me commission settings ka card.
 * Parent Form ke andar render hota hai — apna Form nahi banata.
 *
 * Fields:
 *   commissionEnabled
 *   joinFeesCommissionEnabled / joinFeesCommissionType / joinFeesCommissionValue
 *   closingCommissionEnabled  / closingCommissionType  / closingCommissionValue
 */
const RuleRow = ({
  title,
  subtitle,
  enabledName,
  typeName,
  valueName,
  enabled,
  type,
  accent,
}) => (
  <div
    style={{
      border: `1px solid ${enabled ? accent.border : '#e5e7eb'}`,
      background: enabled ? accent.bg : '#fafafa',
      borderRadius: 10,
      padding: '12px 14px',
      transition: 'all .2s',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{subtitle}</div>
      </div>
      <Form.Item name={enabledName} valuePropName="checked" noStyle>
        <Switch size="small" />
      </Form.Item>
    </div>

    {enabled && (
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, marginTop: 12 }}>
        <Form.Item name={typeName} label={<span style={{ fontSize: 11 }}>Type</span>} style={{ marginBottom: 0 }}>
          <Select size="middle">
            <Option value={COMMISSION_TYPE.PERCENTAGE}>
              <PercentageOutlined /> Percentage
            </Option>
            <Option value={COMMISSION_TYPE.FIXED}>
              <DollarOutlined /> Fixed ₹
            </Option>
          </Select>
        </Form.Item>

        <Form.Item
          name={valueName}
          label={
            <span style={{ fontSize: 11 }}>
              {type === COMMISSION_TYPE.FIXED ? 'Amount per payment (₹)' : 'Percent of payment (%)'}
            </span>
          }
          style={{ marginBottom: 0 }}
          rules={[
            { required: true, message: 'Value required' },
            {
              validator: (_, v) => {
                if (v === undefined || v === null || v === '') return Promise.resolve();
                if (Number(v) < 0) return Promise.reject(new Error('Cannot be negative'));
                if (type === COMMISSION_TYPE.PERCENTAGE && Number(v) > 100)
                  return Promise.reject(new Error('Percentage cannot exceed 100'));
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={type === COMMISSION_TYPE.PERCENTAGE ? 100 : undefined}
            step={type === COMMISSION_TYPE.PERCENTAGE ? 0.5 : 10}
            addonAfter={type === COMMISSION_TYPE.FIXED ? '₹' : '%'}
            placeholder={String(DEFAULT_COMMISSION_PERCENT)}
          />
        </Form.Item>
      </div>
    )}
  </div>
);

const CommissionSettingsCard = ({ form }) => {
  const commissionEnabled = Form.useWatch('commissionEnabled', form);
  const joinFeesEnabled = Form.useWatch('joinFeesCommissionEnabled', form);
  const joinFeesType = Form.useWatch('joinFeesCommissionType', form);
  const closingEnabled = Form.useWatch('closingCommissionEnabled', form);
  const closingType = Form.useWatch('closingCommissionType', form);

  return (
    <Card
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GiftOutlined style={{ color: '#b45309' }} />
          Commission Settings
        </span>
      }
      className="shadow-sm"
      extra={
        <Form.Item name="commissionEnabled" valuePropName="checked" noStyle>
          <Switch checkedChildren="ON" unCheckedChildren="OFF" />
        </Form.Item>
      }
    >
      {!commissionEnabled ? (
        <Alert
          type="info"
          showIcon
          message="Commission band hai"
          description="Is agent ko join fees ya closing payment par koi commission nahi milega. Enable karne ke liye upar wala switch ON karein."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RuleRow
            title="Join Fees Commission"
            subtitle="Jab is agent ke member ki join fees collect hogi"
            enabledName="joinFeesCommissionEnabled"
            typeName="joinFeesCommissionType"
            valueName="joinFeesCommissionValue"
            enabled={joinFeesEnabled !== false}
            type={joinFeesType || COMMISSION_TYPE.PERCENTAGE}
            accent={{ bg: '#f0fdf4', border: '#bbf7d0' }}
          />

          <RuleRow
            title="Closing Payment Commission"
            subtitle="Jab is agent ka member closing/marriage payment karega"
            enabledName="closingCommissionEnabled"
            typeName="closingCommissionType"
            valueName="closingCommissionValue"
            enabled={closingEnabled !== false}
            type={closingType || COMMISSION_TYPE.PERCENTAGE}
            accent={{ bg: '#eff6ff', border: '#bfdbfe' }}
          />

          <Divider style={{ margin: '4px 0' }} />

          <div
            style={{
              fontSize: 11,
              color: '#92400e',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '8px 12px',
              lineHeight: 1.6,
            }}
          >
            Default {DEFAULT_COMMISSION_PERCENT}% hai. Payment add karte waqt har member/payment ke liye
            commission amount alag se badla ya skip bhi kiya ja sakta hai.
          </div>
        </div>
      )}
    </Card>
  );
};

export default CommissionSettingsCard;
