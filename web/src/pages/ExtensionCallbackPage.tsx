import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buildChromeExtensionAuthCallbackUrl,
  isValidExtensionId,
  resolveExtensionId,
} from '../lib/extensionAuth';

export function ExtensionCallbackPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [params] = useSearchParams();
  const extId = resolveExtensionId(params.get('ext_id'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      const signInUrl = isValidExtensionId(extId)
        ? `${window.location.origin}/sign-in?ext_id=${encodeURIComponent(extId)}&redirect=extension`
        : `${window.location.origin}/sign-in?redirect=extension`;
      window.location.replace(signInUrl);
      return;
    }

    if (!isValidExtensionId(extId)) {
      setError(
        'Missing or invalid extension id. Close this window and try again from the StudyFlow Profile tab.'
      );
      return;
    }

    void (async () => {
      try {
        const token = await getToken({ skipCache: true });
        if (!token) {
          setError('Could not create a session token. Please try again.');
          return;
        }

        const callbackUrl = buildChromeExtensionAuthCallbackUrl(extId, token);
        if (!callbackUrl) {
          setError(
            'Invalid extension id. Close this window and try again from the StudyFlow Profile tab.'
          );
          return;
        }

        window.location.replace(callbackUrl);
      } catch {
        setError('Authentication failed. Please close this window and try again.');
      }
    })();
  }, [isLoaded, isSignedIn, getToken, extId]);

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <h1>Returning to extension…</h1>
          <p className={error ? 'status error' : 'status'}>
            {error ?? 'Completing sign-in. This window will close automatically.'}
          </p>
        </div>
      </div>
    </div>
  );
}
