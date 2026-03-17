# A3 Onboarding + Ingest Sequence Diagrams

This document contains two diagrams:

1.  **Full onboarding flow**
2.  **Expanded ingest phase**

Both diagrams use Mermaid sequence syntax.

------------------------------------------------------------------------

# Full System Sequence

``` mermaid
sequenceDiagram
    participant U as User (Telegram)
    participant IVA as A3 ID Verify Agent
    participant SV as Tool: Selfie Verify
    participant IDV as Tool: ID Verify
    participant FM as Tool: Face Match
    participant CA as A3 Consent Agent
    participant CL as Tool: Consent Form Link
    participant SIG as 3rd Party Signature Tool
    participant S as Our Server (Webhook)
    participant PA as A3 Payment Agent
    participant PAY as Tool: Pay
    participant IA as A3 Ingest Agent

    U->>IVA: /start
    IVA->>U: What is your name?
    U->>IVA: Name

    Note right of IVA: Save name in state

    IVA->>U: Please upload your ID and a selfie

    U->>IVA: Upload ID + Selfie

    IVA->>SV: is_selfie(image)
    SV-->>IVA: true

    IVA->>IDV: is_id(image)
    IDV-->>IVA: true

    IVA->>FM: face_match(ID, selfie)
    FM-->>IVA: true

    Note right of IVA: Identity verified

    IVA->>CA: transition → consent

    CA->>CL: generate_consent_link()
    CL-->>CA: form_url

    CA->>U: send consent doc link

    U->>SIG: open form_url and sign

    SIG-->>S: webhook(signature_complete)

    S-->>CA: notify consent complete

    CA->>PA: transition → first payment

    PA->>PAY: setup_payment()
    PAY-->>PA: payment_link

    PA->>U: send payment setup link

    PA->>IA: transition → ingest
```

------------------------------------------------------------------------

# Expanded Ingest Phase

``` mermaid
sequenceDiagram
    participant U as User (Telegram)
    participant IA as A3 Ingest Agent
    participant IT as Tool: Image Ingestion Validator
    participant S as State Store
    participant P2 as A3 Payment 2 Agent

    Note over IA,S: photo_count starts at 0 (min=5, max=20)

    IA->>U: Please send photos of yourself (5–20)

    U->>IA: Upload photo
    IA->>IT: validate_image(photo)

    IT-->>IA: accepted / rejected

    IA->>S: increment photo_count if accepted
    IA->>U: inform user if photo accepted or rejected

    IA->>U: If photo_count < 5 ask for more photos

    IA->>U: If photo_count ≥ 5 user may type DONE

    U->>IA: DONE
    IA->>P2: transition to Payment 2

    IA->>U: If photo_count reaches 20 auto transition

    IA->>P2: transition to Payment 2
```
