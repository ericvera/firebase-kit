Is the following actually an issue?
---

In firebase-kit-admin's src/validation/internal/validateSchema.ts, the test case does this:


case 'test':
  message = `${subject} failed custom validation (error: '${error.message}').`;
subject is already Value of '<path>'. In betterbe 6, error.message also starts with the path (<path>: <reason>), so the path appears twice:


Value of 'phone' failed custom validation (error: 'phone: invalid phone number').
The fix is to use only the reason part of betterbe's message, without the path in front. Either use a field from betterbe that holds just the reason, if ValidationError has one, or strip the <pathString>:  prefix from error.message.
