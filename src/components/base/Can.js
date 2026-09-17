'use client';
import React from 'react';
import { Tooltip } from 'antd';
import { useAuth } from '@/lib/AuthProvider';
import { can as canDo, ACTIONS } from '@/lib/permissions';

/**
 * Permission ke hisaab se UI chhupata ya disable karta hai.
 *
 *   // permission na ho toh kuch render hi na ho
 *   <Can screen="members" action="create">
 *     <Button>Add Member</Button>
 *   </Can>
 *
 *   // dikhe par disabled rahe, hover par wajah bataye
 *   <Can screen="members" action="delete" mode="disable">
 *     <Button danger>Delete</Button>
 *   </Can>
 *
 * @param {string} screen  permissions key — 'members', 'agents', ...
 * @param {string} action  'view' | 'create' | 'edit' | 'delete'
 * @param {string} mode    'hide' (default) ya 'disable'
 * @param {node}   fallback  'hide' mode me permission na hone par kya dikhe
 */
const Can = ({ screen, action = ACTIONS.VIEW, mode = 'hide', fallback = null, children }) => {
  const { user } = useAuth();
  const allowed = canDo(user, screen, action);

  if (allowed) return children;
  if (mode !== 'disable') return fallback;

  return (
    <Tooltip title="इसकी अनुमति आपके account को नहीं है">
      <span style={{ cursor: 'not-allowed', display: 'inline-block' }}>
        {React.isValidElement(children)
          ? React.cloneElement(children, { disabled: true })
          : children}
      </span>
    </Tooltip>
  );
};

/** Hook version — conditions ya handlers ke andar check karne ke liye */
export const useCan = () => {
  const { user } = useAuth();
  return React.useCallback(
    (screen, action = ACTIONS.VIEW) => canDo(user, screen, action),
    [user]
  );
};

export default Can;
