# TrustCredo Identity Verification SDK

A lightweight JavaScript SDK for embedding identity verification flows into your web application.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Callbacks & Events](#callbacks--events)
- [Theming](#theming)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)
- [Examples](#examples)

---

## Installation

### Option 1: CDN (Recommended for quick integration)

Add the SDK script to your HTML:

```html
<script src="https://cdn.trustcredo.com/sdk/v1/idv.min.js"></script>
```

### Option 2: NPM (For modern JavaScript projects)

```bash
npm install @trustcredo/idv-sdk
```

Or with yarn:

```bash
yarn add @trustcredo/idv-sdk
```

---

## Quick Start

### Using CDN (Script Tag)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Identity Verification</title>
</head>
<body>
  <button id="verify-btn">Verify Identity</button>

  <script src="https://cdn.trustcredo.com/sdk/v1/idv.min.js"></script>
  <script>
    // Initialize the SDK with your API key
    IDV.init({
      apiKey: 'pk_live_your_api_key_here'
    });

    // Start verification when button is clicked
    document.getElementById('verify-btn').addEventListener('click', function() {
      IDV.start({
        user: {
          id: 'user_123',           // Your internal user ID
          email: 'user@example.com',
          name: 'John Doe'
        },
        onComplete: function(result) {
          console.log('Verification completed:', result);
          if (result.result.passed) {
            // Verification successful
            alert('Identity verified successfully!');
          } else {
            // Verification failed
            alert('Verification failed: ' + result.result.message);
          }
        },
        onError: function(error) {
          console.error('Verification error:', error);
        }
      });
    });
  </script>
</body>
</html>
```

### Using NPM (ES Modules)

```javascript
import { IDV } from '@trustcredo/idv-sdk';

// Initialize the SDK
IDV.init({
  apiKey: 'pk_live_your_api_key_here',
  environment: 'production'
});

// Start verification
async function startVerification() {
  try {
    const result = await IDV.start({
      user: {
        id: 'user_123',
        email: 'user@example.com',
        name: 'John Doe'
      }
    });

    if (result.result.passed) {
      console.log('Verification passed!', result);
    } else {
      console.log('Verification failed:', result.result.message);
    }
  } catch (error) {
    if (error.code === 'USER_CANCELLED') {
      console.log('User cancelled verification');
    } else {
      console.error('Verification error:', error);
    }
  }
}
```

### React Integration

```jsx
import { useCallback } from 'react';
import { IDV } from '@trustcredo/idv-sdk';

// Initialize once (outside component or in useEffect)
IDV.init({
  apiKey: 'pk_live_your_api_key_here'
});

function VerifyButton({ userId, userEmail, userName, onSuccess, onFailure }) {
  const handleVerify = useCallback(async () => {
    try {
      const result = await IDV.start({
        user: {
          id: userId,
          email: userEmail,
          name: userName
        },
        theme: {
          primaryColor: '#4F46E5'
        },
        onStep: (step) => {
          console.log('Step:', step.step, `(${step.stepNumber}/${step.totalSteps})`);
        }
      });

      if (result.result.passed) {
        onSuccess?.(result);
      } else {
        onFailure?.(result);
      }
    } catch (error) {
      if (error.code !== 'USER_CANCELLED') {
        console.error('Verification error:', error);
        onFailure?.(error);
      }
    }
  }, [userId, userEmail, userName, onSuccess, onFailure]);

  return (
    <button onClick={handleVerify}>
      Verify Identity
    </button>
  );
}

export default VerifyButton;
```

---

## Configuration

### IDV.init(config)

Initialize the SDK with your configuration. Must be called before `IDV.start()`.

```javascript
IDV.init({
  apiKey: 'pk_live_your_api_key_here',  // Required
  environment: 'production',             // 'sandbox' or 'production'
  baseUrl: 'https://verify.trustcredo.com', // Optional: override verification URL
  debug: false                           // Enable debug logging
});
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apiKey` | string | Yes | - | Your partner API key (starts with `pk_live_` or `pk_test_`) |
| `environment` | string | No | `'production'` | `'sandbox'` for testing, `'production'` for live |
| `baseUrl` | string | No | - | Override the verification app URL |
| `debug` | boolean | No | `false` | Enable console debug logging |

---

## API Reference

### IDV.start(options)

Start the verification flow. Returns a Promise that resolves when verification completes.

```javascript
const result = await IDV.start({
  // User context
  user: {
    id: 'user_123',           // Your internal user ID (for webhook reference)
    email: 'user@example.com', // User's email
    name: 'John Doe'          // User's full name
  },

  // Document options
  allowedDocumentTypes: ['passport', 'drivers_license', 'id_card'],
  country: 'US',              // Pre-select country
  locale: 'en',               // UI language

  // Theme customization
  theme: {
    primaryColor: '#4F46E5',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '12px',
    logoUrl: 'https://yourcompany.com/logo.png'
  },

  // Modal behavior
  modal: {
    closeOnOverlayClick: false,
    closeOnEscape: true,
    showCloseButton: true,
    preventScroll: true
  },

  // Callbacks
  onReady: () => console.log('SDK ready'),
  onStart: () => console.log('Verification started'),
  onStep: (step) => console.log('Step:', step),
  onComplete: (result) => console.log('Complete:', result),
  onError: (error) => console.error('Error:', error),
  onClose: (reason) => console.log('Closed:', reason)
});
```

### IDV.close()

Programmatically close the verification modal.

```javascript
IDV.close();
```

### IDV.isOpen()

Check if verification modal is currently open.

```javascript
if (IDV.isOpen()) {
  console.log('Verification in progress');
}
```

### IDV.isInitialized()

Check if SDK has been initialized.

```javascript
if (!IDV.isInitialized()) {
  IDV.init({ apiKey: 'pk_live_...' });
}
```

### IDV.getVersion()

Get the SDK version.

```javascript
console.log('SDK Version:', IDV.getVersion()); // "1.0.0"
```

---

## Callbacks & Events

### onReady

Called when the verification iframe is loaded and ready.

```javascript
onReady: () => {
  console.log('Verification UI is ready');
}
```

### onStart

Called when the user begins the verification process.

```javascript
onStart: () => {
  console.log('User started verification');
  // Track analytics, disable other UI, etc.
}
```

### onStep

Called when the user progresses through verification steps.

```javascript
onStep: (step) => {
  console.log(`Step: ${step.step} (${step.stepNumber}/${step.totalSteps})`);
}
```

**Step object:**

```typescript
{
  step: 'document_capture',  // Current step name
  stepNumber: 3,             // Current step number
  totalSteps: 8,             // Total steps
  timestamp: '2024-01-15T10:30:00Z'
}
```

**Step names:**
- `intro` - Welcome screen
- `document_select` - Document type selection
- `document_capture` - Camera capture for document
- `document_review` - Review captured document
- `selfie_intro` - Selfie instructions
- `selfie_capture` - Camera capture for selfie
- `selfie_review` - Review captured selfie
- `processing` - Verification in progress
- `complete` - Verification complete

### onComplete

Called when verification completes (passed or failed).

```javascript
onComplete: (result) => {
  console.log('Verification ID:', result.verificationId);
  console.log('Status:', result.status);
  console.log('Passed:', result.result.passed);
  console.log('Risk Level:', result.result.riskLevel);

  if (result.result.passed) {
    // Access extracted data (if permitted by your plan)
    console.log('Name:', result.extractedData?.fullName);
    console.log('DOB:', result.extractedData?.dateOfBirth);
  }
}
```

**Result object:**

```typescript
{
  verificationId: 'ver_abc123',
  status: 'passed' | 'failed' | 'review',
  result: {
    passed: true,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    message: 'Verification successful'
  },
  extractedData: {
    fullName: 'John Doe',
    dateOfBirth: '1990-05-15',
    documentNumber: 'A12345678',
    expiryDate: '2028-05-15',
    issuingCountry: 'USA'
  },
  completedAt: '2024-01-15T10:35:00Z',
  duration: 45000  // milliseconds
}
```

### onError

Called when an error occurs during verification.

```javascript
onError: (error) => {
  console.error('Error code:', error.code);
  console.error('Message:', error.message);

  if (error.recoverable) {
    console.log('User can retry');
  }
}
```

**Error object:**

```typescript
{
  code: 'CAMERA_PERMISSION_DENIED',
  message: 'Camera access was denied',
  details: { ... },
  recoverable: true
}
```

### onClose

Called when the modal is closed.

```javascript
onClose: (reason) => {
  switch (reason) {
    case 'user_closed':
      console.log('User closed the modal');
      break;
    case 'completed':
      console.log('Verification completed');
      break;
    case 'error':
      console.log('Closed due to error');
      break;
    case 'expired':
      console.log('Session expired');
      break;
  }
}
```

---

## Theming

Customize the verification UI to match your brand.

```javascript
IDV.start({
  theme: {
    primaryColor: '#4F46E5',      // Buttons, accents
    backgroundColor: '#ffffff',   // Modal background
    textColor: '#1a1a1a',         // Primary text
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '12px',         // Buttons, cards
    logoUrl: 'https://yourcompany.com/logo.png'  // Your logo
  }
});
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `primaryColor` | string | `#10B981` | Primary button and accent color (hex) |
| `backgroundColor` | string | `#ffffff` | Modal background color |
| `textColor` | string | `#1a1a1a` | Primary text color |
| `fontFamily` | string | System fonts | Font family for all text |
| `borderRadius` | string | `16px` | Border radius for buttons and cards |
| `logoUrl` | string | - | URL to your company logo |

---

## Error Handling

### Error Codes

| Code | Description | Recoverable |
|------|-------------|-------------|
| `INVALID_API_KEY` | API key is invalid or missing | No |
| `NOT_INITIALIZED` | SDK not initialized (call `IDV.init()` first) | No |
| `ALREADY_OPEN` | Verification modal already open | No |
| `BROWSER_NOT_SUPPORTED` | Browser doesn't support required features | No |
| `CAMERA_PERMISSION_DENIED` | User denied camera access | Yes |
| `CAMERA_NOT_FOUND` | No camera detected | Yes |
| `VERIFICATION_FAILED` | Verification checks failed | Yes |
| `DOCUMENT_UNREADABLE` | Could not read document | Yes |
| `FACE_NOT_DETECTED` | No face detected in selfie | Yes |
| `NETWORK_ERROR` | Network request failed | Yes |
| `TIMEOUT` | Request timed out | Yes |
| `SESSION_EXPIRED` | Verification session expired | No |
| `USER_CANCELLED` | User closed the modal | Yes |

### Handling Errors

```javascript
try {
  const result = await IDV.start({ ... });
} catch (error) {
  switch (error.code) {
    case 'USER_CANCELLED':
      // User closed modal - not necessarily an error
      break;

    case 'CAMERA_PERMISSION_DENIED':
      alert('Please allow camera access to verify your identity');
      break;

    case 'NETWORK_ERROR':
      alert('Connection lost. Please check your internet and try again.');
      break;

    default:
      console.error('Verification failed:', error.message);
  }
}
```

---

## TypeScript Support

The SDK includes full TypeScript definitions.

```typescript
import {
  IDV,
  IDVConfig,
  IDVStartOptions,
  VerificationComplete,
  SDKError,
  StepInfo,
  CloseReason,
  ErrorCodes
} from '@trustcredo/idv-sdk';

// Configuration is fully typed
const config: IDVConfig = {
  apiKey: 'pk_live_...',
  environment: 'production',
  debug: true
};

IDV.init(config);

// Start options are fully typed
const options: IDVStartOptions = {
  user: {
    id: 'user_123',
    email: 'user@example.com'
  },
  onComplete: (result: VerificationComplete) => {
    if (result.result.passed) {
      console.log('Verified:', result.extractedData?.fullName);
    }
  },
  onError: (error: SDKError) => {
    if (error.code === ErrorCodes.CAMERA_PERMISSION_DENIED) {
      // Handle camera permission error
    }
  }
};

const result = await IDV.start(options);
```

---

## Examples

### Vue.js Integration

```vue
<template>
  <button @click="startVerification" :disabled="isVerifying">
    {{ isVerifying ? 'Verifying...' : 'Verify Identity' }}
  </button>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { IDV } from '@trustcredo/idv-sdk';

const isVerifying = ref(false);

onMounted(() => {
  IDV.init({
    apiKey: import.meta.env.VITE_IDV_API_KEY
  });
});

async function startVerification() {
  isVerifying.value = true;

  try {
    const result = await IDV.start({
      user: {
        id: props.userId,
        email: props.userEmail
      }
    });

    emit('verified', result);
  } catch (error) {
    if (error.code !== 'USER_CANCELLED') {
      emit('error', error);
    }
  } finally {
    isVerifying.value = false;
  }
}
</script>
```

### Next.js Integration

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function VerifyButton({ userId, userEmail }: Props) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Dynamic import for client-side only
    import('@trustcredo/idv-sdk').then(({ IDV }) => {
      IDV.init({
        apiKey: process.env.NEXT_PUBLIC_IDV_API_KEY!
      });
      setIsReady(true);
    });
  }, []);

  const handleVerify = async () => {
    const { IDV } = await import('@trustcredo/idv-sdk');

    try {
      const result = await IDV.start({
        user: { id: userId, email: userEmail }
      });

      if (result.result.passed) {
        // Redirect or update UI
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  return (
    <button onClick={handleVerify} disabled={!isReady}>
      Verify Identity
    </button>
  );
}
```

### Angular Integration

```typescript
// verify.component.ts
import { Component, OnInit } from '@angular/core';
import { IDV } from '@trustcredo/idv-sdk';

@Component({
  selector: 'app-verify',
  template: `
    <button (click)="startVerification()" [disabled]="isVerifying">
      {{ isVerifying ? 'Verifying...' : 'Verify Identity' }}
    </button>
  `
})
export class VerifyComponent implements OnInit {
  isVerifying = false;

  ngOnInit() {
    IDV.init({
      apiKey: environment.idvApiKey
    });
  }

  async startVerification() {
    this.isVerifying = true;

    try {
      const result = await IDV.start({
        user: {
          id: this.authService.userId,
          email: this.authService.userEmail
        },
        onStep: (step) => {
          console.log('Progress:', step.stepNumber, '/', step.totalSteps);
        }
      });

      if (result.result.passed) {
        this.router.navigate(['/verified']);
      }
    } catch (error: any) {
      if (error.code !== 'USER_CANCELLED') {
        this.notificationService.error(error.message);
      }
    } finally {
      this.isVerifying = false;
    }
  }
}
```

---

## Webhooks

For server-side verification results, configure a webhook URL in your partner dashboard. The SDK sends results to your backend in real-time.

**Webhook payload:**

```json
{
  "event": "verification.completed",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "verificationId": "ver_abc123",
    "referenceId": "user_123",
    "passed": true,
    "score": 95,
    "riskLevel": "LOW",
    "checks": {
      "documentAuthentic": true,
      "documentExpired": false,
      "documentTampered": false,
      "faceMatch": true,
      "faceMatchScore": 0.98,
      "livenessCheck": true
    },
    "extractedData": {
      "fullName": "John Doe",
      "dateOfBirth": "1990-05-15",
      "documentNumber": "A12345678",
      "expiryDate": "2028-05-15",
      "issuingCountry": "USA"
    }
  }
}
```

---

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 60+ |
| Firefox | 55+ |
| Safari | 11+ |
| Edge | 79+ |
| iOS Safari | 11+ |
| Chrome Android | 60+ |

**Requirements:**
- Camera access (for document and selfie capture)
- JavaScript enabled
- HTTPS (required for camera access)

---

## Support

- **Documentation:** https://docs.trustcredo.com
- **API Reference:** https://api.trustcredo.com/docs
- **Email:** support@trustcredo.com
- **GitHub Issues:** https://github.com/trustcredo/idv-sdk/issues

---

## License

MIT License - see LICENSE file for details.
