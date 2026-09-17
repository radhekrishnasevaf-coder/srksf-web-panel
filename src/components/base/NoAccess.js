'use client';
import React from 'react';
import { Result, Button, Tag } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import { navigableScreens, landingPath, ROLE_LABEL } from '@/lib/permissions';

/**
 * Jab user aisi screen kholne ki koshish kare jiska access nahi hai.
 * Sirf sidebar chhupana kaafi nahi — koi seedha URL bhi type kar sakta hai.
 */
const NoAccess = ({ screen }) => {
  const router = useRouter();
  const { user } = useAuth();
  const options = navigableScreens(user);

  // ── Setup/rules ki dikkat — ye "permission nahi hai" se alag hai ──
  const setupProblem = user?.profileError || user?.teamError;
  if (setupProblem) {
    const isPerm = setupProblem === 'permission-denied';
    return (
      <Result
        status="error"
        title={isPerm ? 'Firestore rules access nahi de rahi' : 'Account setup adhoora hai'}
        subTitle={
          <div style={{ fontSize: 13, lineHeight: 1.9, textAlign: 'left', maxWidth: 620, margin: '0 auto' }}>
            {user?.profileError && (
              <div>
                Aapka apna user doc nahi padha ja saka:
                <br />
                <code style={{ fontSize: 11 }}>users/{user?.authUid}</code>
              </div>
            )}
            {user?.teamError === 'not-in-team' && (
              <div>
                Aapka team member record nahi mila:
                <br />
                <code style={{ fontSize: 11 }}>
                  users/{user?.ownerUid}/teamMembers/{user?.authUid}
                </code>
                <div style={{ marginTop: 6 }}>
                  Iska matlab ya toh super admin ne aapko hata diya hai, ya admin
                  banate waqt ye record save nahi ho paya (rules ne roka tha).
                </div>
              </div>
            )}
            {user?.teamError === 'permission-denied' && (
              <div>
                Team member record padhne ki anumati nahi mili:
                <br />
                <code style={{ fontSize: 11 }}>
                  users/{user?.ownerUid}/teamMembers/{user?.authUid}
                </code>
              </div>
            )}
            <div style={{ marginTop: 10, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '10px 14px' }}>
              <strong>Super admin ko batayein:</strong>
              <div style={{ marginTop: 4 }}>
                1. Firebase Console → Firestore → Rules me{' '}
                <code>teamMembers</code> ka block hona chahiye (dekhein{' '}
                <code>srksf-function/firestore.rules</code>)
                <br />
                2. Settings → Team Members me aapka account <strong>Active</strong> hona chahiye
              </div>
            </div>
          </div>
        }
        extra={
          <Button onClick={() => router.push('/auth/login')}>
            Login page par jayein
          </Button>
        }
      />
    );
  }

  return (
    <Result
      icon={<LockOutlined style={{ color: '#d97706' }} />}
      title="इस स्क्रीन का access नहीं है"
      subTitle={
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          <div>
            {screen?.label ? <strong>{screen.label}</strong> : 'यह पेज'} देखने की अनुमति
            आपके account को नहीं दी गई है।
          </div>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>
            {user?.displayName} · <Tag>{ROLE_LABEL[user?.role] || 'Admin'}</Tag>
          </div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
            Access चाहिए तो अपने super admin से कहें — वो Settings → Team Members से दे सकते हैं।
          </div>
        </div>
      }
      extra={
        options.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button type="primary" onClick={() => router.push(landingPath(user))}>
              मेरी स्क्रीन पर जाएँ
            </Button>
            {options.slice(0, 4).map((s) => (
              <Button key={s.key} onClick={() => router.push(s.path)}>
                {s.label}
              </Button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            आपके account को अभी किसी भी स्क्रीन का access नहीं मिला है।
          </div>
        )
      }
    />
  );
};

export default NoAccess;
