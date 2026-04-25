import { useState, useRef, useEffect } from 'react';
import { Settings as SettingsIcon, CheckCircle, AlertCircle, Camera, Loader2, CreditCard, Mail, PlugZap, Shield, ShieldCheck, ShieldOff, Smartphone, Copy } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { getNotifPrefs, setNotifPrefs, requestNotifPermission } from '../lib/notify';
import TeamSettings from '../components/settings/TeamSettings';
import CustomFieldsSettings from '../components/settings/CustomFieldsSettings';
import ApiWebhooksSettings from '../components/settings/ApiWebhooksSettings';
import PushNotificationSettings from '../components/settings/PushNotificationSettings';
import WebsiteTrackingSettings from '../components/settings/WebsiteTrackingSettings';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-accent' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function NotificationsTab({ showToast }) {
  const prefs = getNotifPrefs();
  const [pipelineMove, setPipelineMove] = useState(prefs.pipelineMove || false);
  const [stageMove, setStageMove] = useState(prefs.stageMove || false);
  const [permissionStatus, setPermissionStatus] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const handleToggle = async (key, value, setter) => {
    if (value && permissionStatus !== 'granted') {
      const result = await requestNotifPermission();
      setPermissionStatus(result);
      if (result !== 'granted') {
        showToast('Please allow notifications in your browser to enable this.', 'error');
        return;
      }
    }
    setter(value);
    setNotifPrefs({ ...getNotifPrefs(), [key]: value });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-md space-y-1">
      <h3 className="font-semibold text-sidebar mb-1">Notification Preferences</h3>
      {permissionStatus === 'denied' && (
        <p className="text-xs text-red-500 mb-3">Notifications are blocked in your browser. Enable them in browser settings to use this feature.</p>
      )}
      {permissionStatus === 'unsupported' && (
        <p className="text-xs text-gray-400 mb-3">Your browser doesn't support notifications.</p>
      )}

      <div className="divide-y divide-gray-100">
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-sidebar">Deal moves pipelines</p>
            <p className="text-xs text-gray-400 mt-0.5">Notify when a deal moves from Land Acquisition to Deal Overview (or back)</p>
          </div>
          <Toggle
            checked={pipelineMove}
            onChange={() => handleToggle('pipelineMove', !pipelineMove, setPipelineMove)}
          />
        </div>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-sidebar">Deal moves stages in Deal Overview</p>
            <p className="text-xs text-gray-400 mt-0.5">Notify when a deal moves between Contract Signed, Due Diligence, Development, or Complete</p>
          </div>
          <Toggle
            checked={stageMove}
            onChange={() => handleToggle('stageMove', !stageMove, setStageMove)}
          />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <PushNotificationSettings />
      </div>
    </div>
  );
}

// ── Google SVG logos ───────────────────────────────────────────────────────────
function GoogleSignInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function IntegrationsTab({ showToast }) {
  const { profile } = useAuth();
  const orgId = profile?.active_organization_id;

  // Google state
  const [integration, setIntegration]     = useState(null);
  const [loading, setLoading]             = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // PandaDoc state
  const [pandaConn, setPandaConn]         = useState(null);
  const [pandaLoading, setPandaLoading]   = useState(true);
  const [pandaConnecting, setPandaConnecting] = useState(false);
  const [pandaDisconnecting, setPandaDisconnecting] = useState(false);

  // Load Google integration
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from('user_integrations')
      .select('*')
      .eq('provider', 'google')
      .maybeSingle()
      .then(({ data }) => { setIntegration(data); setLoading(false); });
  }, []);

  // Load PandaDoc connection
  useEffect(() => {
    if (!supabase || !orgId) { setPandaLoading(false); return; }
    supabase
      .from('esign_connections')
      .select('id, auth_method, connected_at')
      .eq('organization_id', orgId)
      .eq('provider', 'pandadoc')
      .maybeSingle()
      .then(({ data }) => { setPandaConn(data); setPandaLoading(false); });
  }, [orgId]);

  // Handle redirect back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Google callback
    if (params.get('connected') === 'google') {
      showToast('Google connected successfully.');
      window.history.replaceState({}, '', '/settings?tab=integrations');
      supabase?.from('user_integrations').select('*').eq('provider','google').maybeSingle()
        .then(({ data }) => setIntegration(data));
    }
    if (params.get('error')) {
      showToast('Google connection failed: ' + params.get('error'), 'error');
      window.history.replaceState({}, '', '/settings?tab=integrations');
    }

    // PandaDoc OAuth callback: ?code=CODE
    const code = params.get('code');
    if (code && !params.get('connected')) {
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/api/pandadoc/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ code }),
          });
          if (res.ok) {
            showToast('PandaDoc connected successfully.');
            // Reload connection
            const { data } = await supabase
              .from('esign_connections')
              .select('id, auth_method, connected_at')
              .eq('organization_id', orgId)
              .eq('provider', 'pandadoc')
              .maybeSingle();
            setPandaConn(data);
          } else {
            const d = await res.json();
            showToast(d.error || 'PandaDoc connection failed.', 'error');
          }
        } catch (e) {
          showToast('PandaDoc connection failed.', 'error');
        }
        window.history.replaceState({}, '', '/settings?tab=integrations');
      })();
    }
  }, []);

  const handleGoogleConnect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const state = session?.access_token || '';
    window.location.href = `/api/google/auth?state=${encodeURIComponent(state)}`;
  };

  const handleGoogleDisconnect = async () => {
    if (!window.confirm('Disconnect Google? You will no longer be able to send emails or sync your calendar from the CRM.')) return;
    setDisconnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/google/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) { setIntegration(null); showToast('Google disconnected.'); }
    else showToast('Failed to disconnect.', 'error');
    setDisconnecting(false);
  };

  const handlePandaConnect = async () => {
    setPandaConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/pandadoc/auth', { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const { url, error } = await res.json();
      if (error) { showToast(error, 'error'); setPandaConnecting(false); return; }
      window.location.href = url;
    } catch {
      showToast('Failed to start PandaDoc connection.', 'error');
      setPandaConnecting(false);
    }
  };

  const handlePandaDisconnect = async () => {
    if (!window.confirm('Disconnect PandaDoc? Existing envelopes will remain.')) return;
    setPandaDisconnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/pandadoc/disconnect', { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (res.ok) { setPandaConn(null); showToast('PandaDoc disconnected.'); }
    else showToast('Failed to disconnect PandaDoc.', 'error');
    setPandaDisconnecting(false);
  };

  const isGoogleConnected = !!integration?.gmail_email;
  const isPandaConnected  = !!pandaConn;

  return (
    <div className="max-w-md space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
            <PlugZap size={18} className="text-gray-500" />
          </div>
          <div>
            <p className="font-semibold text-sidebar">Integrations</p>
            <p className="text-xs text-gray-400">Connect your accounts</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Google card */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                <GoogleIcon />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Google (Gmail + Calendar)</p>
                <p className="text-xs text-gray-400">Send emails and sync your Google Calendar</p>
              </div>
              {isGoogleConnected && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle size={10} />Connected
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
            ) : isGoogleConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                  <Mail size={13} className="text-green-600" />
                  <span className="text-sm text-green-800 font-medium">{integration.gmail_email}</span>
                </div>
                <p className="text-xs text-gray-400">
                  Emails sent from contact records will be delivered from this Gmail account.
                </p>
                <button
                  onClick={handleGoogleDisconnect}
                  disabled={disconnecting}
                  className="w-full py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect Google'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  Connect your Google account to send emails from contact records and sync your Google Calendar.
                </p>
                <button
                  onClick={handleGoogleConnect}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <GoogleIcon />
                  Connect Google
                </button>
              </div>
            )}
          </div>

          {/* PandaDoc card */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm overflow-hidden">
                <img src="https://www.pandadoc.com/app/themes/pandadoc/img/favicons/favicon-32x32.png" alt="PandaDoc" className="w-5 h-5" onError={e => { e.target.style.display='none'; }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">PandaDoc</p>
                <p className="text-xs text-gray-400">Send and track e-signature documents</p>
              </div>
              {isPandaConnected && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle size={10} />Connected
                </span>
              )}
            </div>

            {pandaLoading ? (
              <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
            ) : isPandaConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                  <CheckCircle size={13} className="text-green-600" />
                  <span className="text-sm text-green-800 font-medium">
                    Connected via {pandaConn.auth_method === 'api_key' ? 'API key' : 'OAuth'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Go to <a href="/esign" className="text-accent hover:underline">E-Sign</a> to sync templates and send documents.
                </p>
                <button
                  onClick={handlePandaDisconnect}
                  disabled={pandaDisconnecting}
                  className="w-full py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {pandaDisconnecting ? 'Disconnecting…' : 'Disconnect PandaDoc'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  Connect PandaDoc to send contracts, purchase agreements, and other documents for e-signature directly from the CRM.
                </p>
                <button
                  onClick={handlePandaConnect}
                  disabled={pandaConnecting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#26d6a4' }}
                >
                  {pandaConnecting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {pandaConnecting ? 'Connecting…' : 'Connect PandaDoc'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function SecurityTab({ showToast }) {
  const [factors,     setFactors]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [enrolling,   setEnrolling]   = useState(false);
  const [enrollData,  setEnrollData]  = useState(null); // { id, qrCode, secret }
  const [verifyCode,  setVerifyCode]  = useState('');
  const [verifying,   setVerifying]   = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [copied,      setCopied]      = useState(false);

  // Google SSO toggle
  const [ssoEnabled,   setSsoEnabled]   = useState(true);
  const [ssoLoading,   setSsoLoading]   = useState(true);
  const [ssoSaving,    setSsoSaving]    = useState(false);

  const loadFactors = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp || []).filter(f => f.status === 'verified'));
    setLoading(false);
  };

  useEffect(() => { loadFactors(); }, []);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/google/sso-config', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setSsoEnabled(d.enabled); })
        .finally(() => setSsoLoading(false));
    });
  }, []);

  const handleSsoToggle = async () => {
    setSsoSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const next = !ssoEnabled;
    const res = await fetch('/api/google/sso-config', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: next }),
    });
    if (res.ok) {
      setSsoEnabled(next);
      showToast(`Google Sign-In ${next ? 'enabled' : 'disabled'}.`);
    } else {
      const { error } = await res.json();
      showToast(error || 'Failed to update SSO setting.', 'error');
    }
    setSsoSaving(false);
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'LotLine CRM',
    });
    setEnrolling(false);
    if (error) { showToast(error.message, 'error'); return; }
    setEnrollData({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setVerifyCode('');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!enrollData || verifyCode.trim().length !== 6) return;
    setVerifying(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollData.id,
      code: verifyCode.trim(),
    });
    setVerifying(false);
    if (error) {
      showToast('Invalid code — please check your authenticator and try again.', 'error');
      setVerifyCode('');
      return;
    }
    showToast('Two-factor authentication enabled.');
    setEnrollData(null);
    setVerifyCode('');
    loadFactors();
  };

  const handleCancelEnroll = async () => {
    // Unenroll the pending (unverified) factor so it doesn't litter the factor list
    if (enrollData?.id) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.id }).catch(() => {});
    }
    setEnrollData(null);
    setVerifyCode('');
  };

  const handleUnenroll = async (factorId) => {
    if (!window.confirm('Disable two-factor authentication? Your account will be less secure.')) return;
    setUnenrolling(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setUnenrolling(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Two-factor authentication disabled.');
    loadFactors();
  };

  const copySecret = () => {
    navigator.clipboard.writeText(enrollData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEnabled = factors.length > 0;

  return (
    <div className="max-w-md space-y-4">
      {/* 2FA card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-green-50' : 'bg-gray-50'} border border-gray-100`}>
            {isEnabled ? <ShieldCheck size={18} className="text-green-600" /> : <Shield size={18} className="text-gray-500" />}
          </div>
          <div>
            <p className="font-semibold text-sidebar">Two-Factor Authentication</p>
            <p className="text-xs text-gray-400">Require a one-time code on every sign-in</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
        ) : isEnabled && !enrollData ? (
          /* ── Enabled state ── */
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
              <ShieldCheck size={14} className="text-green-600" />
              <span className="text-sm text-green-800 font-medium">2FA is active on your account</span>
            </div>
            <p className="text-xs text-gray-400">
              You'll be asked for a 6-digit code from your authenticator app each time you sign in.
            </p>
            <button
              onClick={() => handleUnenroll(factors[0].id)}
              disabled={unenrolling}
              className="w-full py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {unenrolling ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
              {unenrolling ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </div>
        ) : enrollData ? (
          /* ── Enrollment flow ── */
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Scan the QR code below with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
            </p>
            <div className="flex justify-center">
              <img src={enrollData.qrCode} alt="QR code" className="w-44 h-44 rounded-lg border border-gray-100" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Or enter the secret manually:</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <code className="text-xs text-gray-700 flex-1 break-all font-mono">{enrollData.secret}</code>
                <button onClick={copySecret} className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
                  {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Enter the 6-digit code to verify
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelEnroll}
                  className="flex-1 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyCode.length !== 6 || verifying}
                  className="flex-1 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#c9703a' }}
                >
                  {verifying ? <><Loader2 size={14} className="animate-spin" />Verifying…</> : 'Enable 2FA'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ── Disabled state ── */
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Add an extra layer of security. After enabling, you'll need your authenticator app every time you sign in.
            </p>
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#c9703a' }}
            >
              {enrolling ? <><Loader2 size={14} className="animate-spin" />Setting up…</> : <><Smartphone size={14} />Set Up Authenticator App</>}
            </button>
          </div>
        )}
      </div>

      {/* Google SSO card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
            <GoogleSignInIcon />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sidebar">Google Sign-In (SSO)</p>
            <p className="text-xs text-gray-400">Sign in with your Google account</p>
          </div>
          {!ssoLoading && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${ssoEnabled ? 'text-green-600 bg-green-50 border border-green-100' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>
              {ssoEnabled ? <><CheckCircle size={10} />Enabled</> : 'Disabled'}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {ssoEnabled
            ? 'Team members can sign in using their Google account on the login page.'
            : 'Google Sign-In is currently disabled. Team members must sign in with email and password.'}
        </p>
        <button
          onClick={handleSsoToggle}
          disabled={ssoSaving || ssoLoading}
          className={`w-full py-2 text-sm font-medium rounded-xl border transition-colors disabled:opacity-50 ${ssoEnabled ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-700 border-green-200 hover:bg-green-50'}`}
        >
          {ssoSaving ? 'Saving…' : ssoEnabled ? 'Disable Google Sign-In' : 'Enable Google Sign-In'}
        </button>
      </div>
    </div>
  );
}

function BillingTab() {
  const { profile, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  async function handleCancel() {
    setCancelling(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/account/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Cancellation failed');
      await signOut();
    } catch (e) {
      setError(e.message);
      setCancelling(false);
      setConfirming(false);
    }
  }

  const planLabel = profile?.org?.plan
    ? profile.org.plan.charAt(0).toUpperCase() + profile.org.plan.slice(1)
    : 'Pro';

  return (
    <div className="max-w-md space-y-4">
      {/* Current plan card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <CreditCard size={18} className="text-accent" />
          </div>
          <div>
            <p className="font-semibold text-sidebar">Subscription</p>
            <p className="text-xs text-gray-400">Manage your plan</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <span className="text-sm text-gray-600">Current plan</span>
          <span className="text-sm font-semibold text-sidebar capitalize">{planLabel}</span>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <span className="text-sm text-gray-600">Status</span>
          <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">Active</span>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-100 p-6">
        <h3 className="font-semibold text-red-600 mb-1">Cancel Subscription</h3>
        <p className="text-sm text-gray-500 mb-4">
          Cancelling will permanently delete your account and all associated data. This cannot be undone.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-3">
            {error}
          </div>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
          >
            Cancel my subscription
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-red-700">Are you absolutely sure? Your account will be deleted immediately.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Keep my account
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Yes, delete my account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const VALID_TABS = ['profile','team','notifications','integrations','security','custom-fields','api','website-tracking','billing'];
  const rawTab = new URLSearchParams(window.location.search).get('tab') || 'profile';
  const initialTab = VALID_TABS.includes(rawTab) ? rawTab : 'profile';
  const [tab, setTab] = useState(initialTab);
  const { profile, updateProfile } = useAuth();

  // Profile tab state
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]     = useState('');
  const [phone,       setPhone]        = useState('');
  const [saving,      setSaving]       = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [toast,       setToast]        = useState(null);
  const fileInputRef = useRef(null);

  // Populate fields from profile when available
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || (profile.name?.split(' ')[0] ?? ''));
      setLastName(profile.last_name  || (profile.name?.split(' ').slice(1).join(' ') ?? ''));
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSaving(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { error } = await updateProfile({
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
      name:       fullName,
      phone:      phone.trim() || null,
    });
    if (error) {
      showToast('Failed to save: ' + (error.message || error), 'error');
    } else {
      showToast('Profile updated successfully.');
    }
    setSaving(false);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    setPhotoUploading(true);
    try {
      // Resize to 256×256 and convert to compressed JPEG data URL (no storage bucket needed)
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          // Crop to square from center
          const min = Math.min(img.width, img.height);
          const sx = (img.width - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
      const { error } = await updateProfile({ avatar_url: dataUrl });
      if (error) throw error;
      showToast('Photo updated.');
    } catch (err) {
      showToast('Upload failed: ' + (err.message || err), 'error');
    }
    setPhotoUploading(false);
    e.target.value = '';
  };

  const avatarUrl = profile?.avatar_url;
  const initials = firstName
    ? `${firstName[0]}${lastName?.[0] ?? ''}`.toUpperCase()
    : (profile?.name ?? '?')[0].toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-600 rounded-lg">
          <SettingsIcon size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Settings</h1>
          <p className="text-sm text-gray-500">Configure your CRM preferences</p>
        </div>
      </div>

      <div className="flex bg-card rounded-lg p-1 w-fit">
        {['profile', 'team', 'notifications', 'integrations', 'security', 'custom-fields', 'api', 'website-tracking', 'billing'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.replace(/-/g, ' ')}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-md">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xl overflow-hidden">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  : initials
                }
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center shadow-md hover:bg-accent/90 transition-colors disabled:opacity-50"
                title="Upload photo"
              >
                {photoUploading
                  ? <Loader2 size={12} className="text-white animate-spin" />
                  : <Camera size={12} className="text-white" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div>
              <p className="font-semibold text-[#1a2332]">{profile?.name || 'Your Name'}</p>
              <p className="text-xs text-gray-400">{profile?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">Click the camera icon to update photo</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="text"
                value={profile?.email ?? ''}
                disabled
                className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
            </div>

            <button
              type="submit"
              disabled={saving || !firstName.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: saving || !firstName.trim() ? '#94a3b8' : '#c9703a' }}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>
      )}

      {tab === 'team' && <TeamSettings />}

      {tab === 'notifications' && (
        <NotificationsTab showToast={showToast} />
      )}

      {tab === 'integrations' && <IntegrationsTab showToast={showToast} />}

      {tab === 'security' && <SecurityTab showToast={showToast} />}

      {tab === 'custom-fields' && <CustomFieldsSettings />}

      {tab === 'api' && <ApiWebhooksSettings />}

      {tab === 'website-tracking' && <WebsiteTrackingSettings />}

      {tab === 'billing' && <BillingTab />}

      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
