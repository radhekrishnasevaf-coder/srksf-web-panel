'use client';
import CertificateViewer from '@/components/pdfcom/Certificates';
import CertificateServerSide from '@/components/pdfcom/Certificates/CertificateComServerSide';
import { pdf } from '@react-pdf/renderer';
import { Button, Drawer, Space, Typography, Alert, Modal, Tag, App } from 'antd';
import { DownloadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import React from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useAuth } from '@/lib/AuthProvider';
import Can from '@/components/base/Can';
import {
  getCertificateStatus,
  markCertificateDownloaded,
  triggerBlobDownload,
} from '@/lib/services/certificateService';

const { Title, Text } = Typography;

const MemberCertificateCom = ({
  open,
  onClose,
  memberData,
  onDownloaded,   // download ke baad list refresh karne ke liye
}) => {
  const [downloading, setDownloading] = React.useState(false);
  const { message, modal } = App.useApp();
  const { user } = useAuth();

  const selectedProgram = useSelector((state) => state.data.selectedProgram);
  const agentList = useSelector((state) => state.data.agentsList);

  const fileName = memberData
    ? `${memberData.displayName?.replaceAll(' ', '_') + '_' + memberData?.registrationNumber || 'Member'}_Certificate.pdf`
    : 'Certificate.pdf';

  const memberAgent = agentList?.find((x) => x.id === memberData?.agentId);

  const certData = {
    ...memberData,
    agentPhone: memberAgent?.phone,
    agentCode: memberAgent?.agentCode,
  };

  // Pehle download ho chuka hai ya nahi
  const status = getCertificateStatus(memberData);
  const programId = selectedProgram?.id || memberData?.programId;

  /* ── Actual download ─────────────────────────────────────────────────── */
  const doDownload = async () => {
    setDownloading(true);
    try {
      const blob = await pdf(
        <CertificateServerSide data={certData} selectedProgram={selectedProgram} />
      ).toBlob();

      triggerBlobDownload(blob, fileName);

      // Member par nishan lagao
      const marked = await markCertificateDownloaded(user?.uid, programId, memberData, {
        uid: user?.uid,
        name: user?.displayName || user?.name || 'Admin',
      });

      if (marked) {
        message.success(
          status.downloaded
            ? `Certificate dobara download ho gaya (${status.count + 1} baar)`
            : 'Certificate download ho gaya aur mark kar diya gaya'
        );
        onDownloaded?.();
      } else {
        // PDF mil gaya, sirf record nahi ban paya
        message.warning('Certificate download ho gaya, lekin record update nahi ho paya');
      }
    } catch (err) {
      console.error('Certificate download failed:', err);
      message.error('Certificate download nahi ho paya. Dobara koshish karein.');
    } finally {
      setDownloading(false);
    }
  };

  /* ── Download button click ───────────────────────────────────────────── */
  const handleDownloadClick = () => {
    if (!status.downloaded) {
      doDownload();
      return;
    }

    // Pehle se download ho chuka hai — confirm karao
    modal.confirm({
      title: 'Ye certificate pehle hi download ho chuka hai',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      width: 480,
      content: (
        <div style={{ fontSize: 13, lineHeight: 1.9 }}>
          <div>
            <Text strong>{memberData?.displayName}</Text>
            {memberData?.registrationNumber ? ` (#${memberData.registrationNumber})` : ''}
          </div>
          <div style={{ marginTop: 8, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '8px 12px' }}>
            <div>
              अब तक डाउनलोड: <Text strong>{status.count} बार</Text>
            </div>
            {status.lastAt && (
              <div>
                पिछली बार: <Text strong>{dayjs(status.lastAt).format('DD/MM/YYYY, hh:mm A')}</Text>
              </div>
            )}
            {status.byName && (
              <div>
                किसने: <Text strong>{status.byName}</Text>
              </div>
            )}
          </div>
          <div style={{ marginTop: 10 }}>क्या आप इसे दोबारा डाउनलोड करना चाहते हैं?</div>
        </div>
      ),
      okText: 'हाँ, दोबारा डाउनलोड करें',
      okButtonProps: { danger: true },
      cancelText: 'रद्द करें',
      onOk: doDownload,
    });
  };

  return (
    <div>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Title level={5} style={{ margin: 0 }}>
              {fileName}
            </Title>
            {status.downloaded && (
              <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginInlineEnd: 0 }}>
                डाउनलोड हो चुका · {status.count}x
              </Tag>
            )}
          </div>
        }
        width={800}
        placement="right"
        onClose={onClose}
        open={open}
        maskClosable={false}
        destroyOnHidden
        keyboard={false}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={onClose} size="large" disabled={downloading}>
              रद्द करें
            </Button>
            <Can screen="members" action="download" mode="disable">
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                loading={downloading}
                onClick={handleDownloadClick}
                danger={status.downloaded}
              >
                {downloading
                  ? 'तैयार हो रहा है…'
                  : status.downloaded
                    ? 'दोबारा डाउनलोड करें'
                    : 'Download Pdf'}
              </Button>
            </Can>
          </Space>
        }
      >
        {status.downloaded && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="यह certificate पहले ही डाउनलोड हो चुका है"
            description={
              <span style={{ fontSize: 12 }}>
                कुल <strong>{status.count} बार</strong>
                {status.lastAt && (
                  <> · पिछली बार <strong>{dayjs(status.lastAt).format('DD/MM/YYYY, hh:mm A')}</strong></>
                )}
                {status.byName && <> · <strong>{status.byName}</strong> द्वारा</>}
              </span>
            }
          />
        )}

        <CertificateViewer memberData={certData} selectedProgram={selectedProgram} />
      </Drawer>
    </div>
  );
};

export default MemberCertificateCom;
