[feat] add an optional details argument to checkdocumentexists so a missing-document error carries its context.

Description:

The problem: checkDocumentExists(ref, auth, reader) in firebase-kit-admin throws FunctionsInternalError("<collection> not found: <id>") with no details. When the read happens after a side effect, such as the pickup reading the customer after a Stripe capture, the logged error doesn't say what had already happened.
The change: add an optional details (and maybe a message prefix) argument that gets passed through to the FunctionsInternalError it throws.
