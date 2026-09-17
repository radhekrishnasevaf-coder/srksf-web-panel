'use client';
import React from 'react';
import { Select, InputNumber, Switch, Typography, Tag, Tooltip } from 'antd';
import { GiftOutlined, InfoCircleOutlined, UndoOutlined } from '@ant-design/icons';
import {
  COMMISSION_TYPE,
  calcCommission,
  calcJoinFeesCommission,
  getCommissionConfig,
  rateLabel,
  fmtMoney,
  toNum,
  COMMISSION_SOURCE,
} from '@/lib/services/commissionService';

const { Text } = Typography;
const { Option } = Select;

/**
 * Member add/edit screen par agent select karte hi dikhne wala commission card.
 *
 * Agent ki default rate dikhata hai, aur is member ke liye custom amount
 * set karne deta hai (jaise default ₹1000 hai par is member par sirf ₹500).
 *
 * Controlled component — state parent ke paas rehta hai:
 *   value = { enabled, isCustom, type, value }
 *   onChange(next)
 *
 * @param {object} agent      chuna hua agent doc
 * @param {number} joinFees   member ki poori join fees (preview ke liye)
 * @param {number} paidNow    abhi kitni join fees collect ho rahi hai (0 = abhi koi nahi)
 */
const MemberCommissionCard = ({ agent, joinFees = 0, paidNow = 0, value, onChange }) => {
  if (!agent) return null;

  const cfg = getCommissionConfig(agent);
  const agentName = agent.displayName || agent.name || 'Agent';

  // Agent ke level par hi commission band hai
  if (!cfg.enabled || !cfg.joinFees.enabled) {
    return (
      <div
        style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <InfoCircleOutlined style={{ color: '#9ca3af' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          <strong>{agentName}</strong> ke liye join fees commission band hai —
          agent edit karke "Commission Settings" me enable karein.
        </Text>
      </div>
    );
  }

  const v = value || { enabled: true, isCustom: false, type: cfg.joinFees.type, value: cfg.joinFees.value };
  const set = (patch) => onChange?.({ ...v, ...patch });

  // Preview kis amount par — agar abhi join fees collect ho rahi hai toh wahi,
  // warna poori join fees maan kar dikhao
  const previewBase = paidNow > 0 ? toNum(paidNow) : toNum(joinFees);

  const agentDefault = calcCommission(agent, COMMISSION_SOURCE.JOIN_FEES, previewBase);
  const resolved = calcJoinFeesCommission(agent, { joinFeesCommission: v }, previewBase);

  return (
    <div
      style={{
        background: v.enabled ? '#fffbeb' : '#f9fafb',
        border: `1px solid ${v.enabled ? '#fde68a' : '#e5e7eb'}`,
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <GiftOutlined style={{ color: '#b45309' }} />
          <Text strong style={{ color: '#92400e', fontSize: 13 }}>
            एजेंट कमीशन (Join Fees)
          </Text>
          <Tooltip
            title={`${agentName} ki default join fees rate — agent add/edit screen se set hoti hai`}
          >
            <Tag color="gold" style={{ marginInlineEnd: 0, fontSize: 11 }}>
              डिफ़ॉल्ट: {rateLabel(cfg.joinFees.type, cfg.joinFees.value)}
            </Tag>
          </Tooltip>
        </div>

        <Switch
          size="small"
          checked={v.enabled}
          onChange={(checked) => set({ enabled: checked })}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      </div>

      {!v.enabled ? (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          इस सदस्य पर <strong>{agentName}</strong> को कोई कमीशन नहीं मिलेगा।
        </Text>
      ) : (
        <>
          {/* ── Type + amount ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr',
              gap: 10,
              marginTop: 10,
              alignItems: 'end',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>कमीशन प्रकार</div>
              <Select
                size="middle"
                style={{ width: '100%' }}
                value={v.type}
                onChange={(t) => {
                  // type badla = custom maano, aur default value us type ki le lo
                  const fallback =
                    t === cfg.joinFees.type ? cfg.joinFees.value : v.value;
                  set({ type: t, isCustom: true, value: fallback });
                }}
              >
                <Option value={COMMISSION_TYPE.PERCENTAGE}>Percentage %</Option>
                <Option value={COMMISSION_TYPE.FIXED}>Fixed ₹</Option>
              </Select>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                {v.type === COMMISSION_TYPE.FIXED
                  ? 'इस सदस्य पर कमीशन राशि (₹)'
                  : 'इस सदस्य पर कमीशन प्रतिशत (%)'}
              </div>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={v.type === COMMISSION_TYPE.PERCENTAGE ? 100 : undefined}
                step={v.type === COMMISSION_TYPE.PERCENTAGE ? 0.5 : 50}
                value={v.isCustom ? v.value : cfg.joinFees.value}
                onChange={(val) => set({ value: toNum(val), isCustom: true })}
                addonAfter={v.type === COMMISSION_TYPE.FIXED ? '₹' : '%'}
              />
            </div>
          </div>

          {/* ── Preview + reset ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginTop: 10,
              paddingTop: 9,
              borderTop: '1px dashed #fde68a',
              flexWrap: 'wrap',
            }}
          >
            <Text style={{ fontSize: 11, color: '#a16207' }}>
              {previewBase > 0 ? (
                <>
                  {paidNow > 0 ? 'अभी जमा हो रही' : 'पूरी'} join fees{' '}
                  <strong>{fmtMoney(previewBase)}</strong> पर →{' '}
                  <strong style={{ color: '#b45309', fontSize: 13 }}>
                    {fmtMoney(resolved.amount)}
                  </strong>
                  {v.isCustom && agentDefault.amount !== resolved.amount && (
                    <Text delete type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                      {fmtMoney(agentDefault.amount)}
                    </Text>
                  )}
                </>
              ) : (
                <>Join fees सेट नहीं है — कमीशन तब बनेगा जब राशि जमा होगी।</>
              )}
            </Text>

            {v.isCustom && (
              <a
                onClick={() =>
                  set({ isCustom: false, type: cfg.joinFees.type, value: cfg.joinFees.value })
                }
                style={{ fontSize: 11, color: '#92400e', whiteSpace: 'nowrap' }}
              >
                <UndoOutlined /> डिफ़ॉल्ट पर रीसेट ({rateLabel(cfg.joinFees.type, cfg.joinFees.value)})
              </a>
            )}
          </div>

          {paidNow <= 0 && (
            <div
              style={{
                fontSize: 10.5,
                color: '#92400e',
                background: '#fef3c7',
                borderRadius: 6,
                padding: '6px 9px',
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              यह सेटिंग सदस्य पर सेव हो जाएगी — बाद में जब join fees जमा होगी, तब
              एजेंट की डिफ़ॉल्ट दर की जगह <strong>यही</strong> लागू होगी।
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MemberCommissionCard;
