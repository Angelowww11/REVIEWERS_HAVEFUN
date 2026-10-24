# Pocket Search publishing preparation

Status: public website and unpacked download available; no Chrome Web Store or Edge Add-ons listing has been submitted or approved. A publisher must register/sign in, review the declarations below and complete the store submission. Do not display an Add to Chrome / Add to Edge store button until a real approved listing URL exists.

## Prepared files

- `downloads/packet-party-pocket-search-store.zip`: extension files with `manifest.json` at the archive root. Generated with `python build_extension.py`.
- Public landing: https://packet-party-angelowww11s-projects.vercel.app/get-extension
- Privacy: https://packet-party-angelowww11s-projects.vercel.app/extension-privacy.html
- Online demonstration: https://packet-party-angelowww11s-projects.vercel.app/pocket
- Icons: `extension/icons/128.png` and the other manifest sizes.

## Draft listing text

Name: Packet Party — Pocket Search

Short description: Paste a networking question into a floating study panel. Search three offline question banks, answers and explanations.

Description:

Keep your networking question bank beside you. Press the backtick key on a regular webpage to open a compact, draggable question box. Type or paste a question to find matching saved questions, correct answers, original choices, explanations and exhibits.

Includes 509 cards: 198 original question-pool cards, 99 CCST certification cards, and 212 Summative 3 cards. Grouped True/False and matching questions show their answers individually. Separate source variants remain visible when saved answer keys disagree.

Search works locally against the bundled bank, without an account or AI service. The extension stores your last question and display preferences on your device. It does not scrape page text or automatically read your clipboard. Questions are a release snapshot; later bank updates require a new extension version.

Minimize to a floating square, or hide/reopen with backtick. The shortcut does not interrupt typing in other websites’ text fields. Browser settings/store pages and some viewers block webpage injection; the toolbar opens a small separate window there.

## Draft single-purpose and permission declarations

Single purpose: search supplied networking study questions and display their saved answers and explanations in a small user-controlled panel.

- HTTP/HTTPS content scripts: listen for the requested backtick shortcut on regular webpages. No page text is extracted. The panel and question bank are created/loaded only when the user opens the panel.
- `activeTab`: temporary access for the explicit toolbar action.
- `scripting`: initialize/toggle the panel when the toolbar action runs.
- `storage`: last pasted query, chosen bank and answer/explanation display preferences in local extension storage.
- `web_accessible_resources`: the extension-origin panel document can be embedded as the isolated floating iframe.
- No remote code, network AI, account access, clipboard-read permission or analytics in the extension. External links only navigate when clicked.

Review each store’s data definitions before submitting disclosures. Local query text may contain anything a person pastes; it is not transmitted by the extension. Website hosting receives ordinary asset requests for the online version. Public privacy text documents that distinction.

## Publisher steps still required

1. Register or sign in to the human owner’s developer account. Chrome registration involves a one-time fee; do not pay it or accept publisher terms without the human owner’s involvement. Edge submission requires its Partner Center developer account.
2. Confirm the right to distribute the supplied study content publicly. This draft is not a licensing determination.
3. Supply the publisher’s real contact/account details, current store screenshots/promotional assets, category and audience disclosures. Review the permission and privacy statements against the upload.
4. Upload the store ZIP and complete store-specific checks, then submit for review. Approval and a listing URL are external outcomes, not guaranteed by preparing a ZIP.
5. Only after approval, add the returned real store listing URLs to the public page. Keep the ZIP and online options available.

Official references:

- https://developer.chrome.com/docs/webstore/register/
- https://developer.chrome.com/docs/webstore/publish
- https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/create-dev-account
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
