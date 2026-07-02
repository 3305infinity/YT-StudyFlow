import { SignIn, useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buildHostedExtensionCallbackUrl,
  isValidExtensionId,
  resolveExtensionId,
} from '../lib/extensionAuth';

export function SignInPage() {
  const [params] = useSearchParams();
  const extId = resolveExtensionId(params.get('ext_id'));
  const redirect = params.get('redirect');
  const { isLoaded, isSignedIn } = useAuth();

  const callbackUrl = useMemo(() => {
    if (!extId) return null;
    return buildHostedExtensionCallbackUrl(window.location.origin, extId);
  }, [extId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || redirect !== 'extension' || !callbackUrl) return;
    window.location.replace(callbackUrl);
  }, [isLoaded, isSignedIn, redirect, callbackUrl]);

  if (!isLoaded) {
    return (
      <div className="page">
        <div className="card">
          <div className="brand">
            <h1>YT StudyFlow</h1>
            <p className="status">Loading sign-in…</p>
          </div>
        </div>
      </div>
    );
  }

  const missingExtensionId = redirect === 'extension' && !isValidExtensionId(extId);

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <h1>YT StudyFlow</h1>
          <p>Sign in with Google to continue in the extension</p>
        </div>
        {missingExtensionId && (
          <p className="status error">
            Missing extension id. Close this window and open sign-in from the StudyFlow Profile tab.
          </p>
        )}
        {!missingExtensionId && callbackUrl && (
          <SignIn
            routing="path"
            path="/sign-in"
            forceRedirectUrl={callbackUrl}
            signUpForceRedirectUrl={callbackUrl}
            appearance={{
              elements: {
                rootBox: { width: '100%' },
                card: { background: 'transparent', boxShadow: 'none', border: 'none' },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
