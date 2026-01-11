/**
 * IDV SDK - Identity Verification SDK
 *
 * Usage:
 * ```html
 * <script src="https://cdn.trustcredo.com/sdk/v1/idv.min.js"></script>
 * <script>
 *   IDV.init({ apiKey: 'pk_live_...' });
 *   IDV.start({ onComplete: (result) => console.log(result) });
 * </script>
 * ```
 *
 * Or with ES modules:
 * ```javascript
 * import { IDV } from '@anthropic/idv-sdk';
 * IDV.init({ apiKey: 'pk_live_...' });
 * ```
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
