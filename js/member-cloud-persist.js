/**
 * Persistencia de socios y amigos en Firebase vía Netlify (Admin SDK).
 * La web pública no puede escribir en sanabria_members / sanabria_friends directamente.
 */
(function (global) {
  'use strict';

  function stripSecrets(record) {
    const m = record && typeof record === 'object' ? { ...record } : {};
    delete m.password;
    delete m.pass;
    delete m.plainPassword;
    delete m.portalPassword;
    return m;
  }

  function mergeMemberIntoLocal(remoteMember) {
    if (!remoteMember || !remoteMember.id) return remoteMember;
    const email = String(remoteMember.email || '').trim().toLowerCase();
    const list = JSON.parse(global.localStorage.getItem('clubMembers') || '[]');
    let ix = list.findIndex(function (s) {
      return s.id === remoteMember.id;
    });
    if (ix < 0 && email) {
      ix = list.findIndex(function (s) {
        return String(s.email || '').trim().toLowerCase() === email;
      });
    }
    const merged = { ...(ix >= 0 ? list[ix] : {}), ...remoteMember };
    if (ix >= 0) list[ix] = merged;
    else list.push(merged);
    if (typeof global.syncClubMembersLocal === 'function') {
      global.syncClubMembersLocal(list);
    } else {
      global.localStorage.setItem('clubMembers', JSON.stringify(list));
      global.localStorage.setItem('socios', JSON.stringify(list));
    }
    try {
      global.dispatchEvent(new CustomEvent('membersUpdated', { detail: list }));
    } catch (_) {}
    return merged;
  }

  async function persistMemberViaNetlify(member) {
    const res = await fetch('/.netlify/functions/submit-member-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member: stripSecrets(member) })
    });
    const json = await res.json().catch(function () {
      return { ok: false };
    });
    if (!res.ok || !json.ok) {
      const err = new Error(
        json.error ||
          'No se pudo registrar el socio en la nube. Reintenta o contacta con el club (cdsanabriafc@gmail.com).'
      );
      err.code = 'member_persist_failed';
      throw err;
    }
    const remote = json.member || { id: json.memberId, ...member };
    return mergeMemberIntoLocal(remote);
  }

  function mergeFriendIntoLocal(remoteFriend) {
    if (!remoteFriend || !remoteFriend.id) return remoteFriend;
    const email = String(remoteFriend.email || '').trim().toLowerCase();
    const list = JSON.parse(global.localStorage.getItem('clubFriends') || '[]');
    let ix = list.findIndex(function (a) {
      return a.id === remoteFriend.id;
    });
    if (ix < 0 && email) {
      ix = list.findIndex(function (a) {
        return String(a.email || '').trim().toLowerCase() === email;
      });
    }
    const merged = { ...(ix >= 0 ? list[ix] : {}), ...remoteFriend };
    if (ix >= 0) list[ix] = merged;
    else list.push(merged);
    if (typeof global.syncClubFriendsLocal === 'function') {
      global.syncClubFriendsLocal(list);
    } else {
      global.localStorage.setItem('clubFriends', JSON.stringify(list));
      global.localStorage.setItem('amigos', JSON.stringify(list));
    }
    try {
      global.dispatchEvent(new CustomEvent('friendsUpdated', { detail: list }));
    } catch (_) {}
    return merged;
  }

  async function persistFriendViaNetlify(friend) {
    const res = await fetch('/.netlify/functions/submit-friend-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friend: stripSecrets(friend) })
    });
    const json = await res.json().catch(function () {
      return { ok: false };
    });
    if (!res.ok || !json.ok) {
      const err = new Error(
        json.error ||
          'No se pudo registrar el amigo/a en la nube. Reintenta o contacta con el club (cdsanabriafc@gmail.com).'
      );
      err.code = 'friend_persist_failed';
      throw err;
    }
    const remote = json.friend || { id: json.friendId, ...friend };
    return mergeFriendIntoLocal(remote);
  }

  global.ClubMemberCloudPersist = {
    persistMemberViaNetlify: persistMemberViaNetlify,
    mergeMemberIntoLocal: mergeMemberIntoLocal
  };

  global.ClubFriendCloudPersist = {
    persistFriendViaNetlify: persistFriendViaNetlify,
    mergeFriendIntoLocal: mergeFriendIntoLocal
  };

  /** En la web publicada (HTTPS) la nube es obligatoria; en file:// se permite fallback local. */
  global.clubCloudPersistIsRequired = function () {
    try {
      return typeof global.location !== 'undefined' && global.location.protocol !== 'file:';
    } catch (_) {
      return true;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
