/**
 * TrustCredo Identity Verification SDK
 *
 * Usage with CDN:
 * ```html
 * <script src="https://cdn.trustcredo.com/sdk/v1/idv.min.js"></script>
 * <script>
 *   IDV.init({ apiKey: 'pk_live_...' });
 *   IDV.start({ onComplete: (result) => console.log(result) });
 * </script>
 * ```
 *
 * Usage with ES modules:
 * ```javascript
 * import { IDV } from '@trustcredo/idv-sdk';
 * IDV.init({ apiKey: 'pk_live_...' });
 * const result = await IDV.start({ user: { id: 'user_123' } });
 * ```
 *
 * See README.md for full documentation.
 */

import { IDV, IDVCore } from './IDV';

// Export types
export type {
  IDVConfig,
  IDVStartOptions,
  UserContext,
  ThemeOptions,
  ModalOptions,
  StepInfo,
  VerificationComplete,
  SDKError,
  CloseReason,
} from './types';

export { ErrorCodes } from './types';

// Export IDV instance and class
export { IDV, IDVCore };

// Default export for UMD
export default IDV;
