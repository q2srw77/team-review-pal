Change the visible label on the Dashboard tab from **Active** to **Review**. The underlying state variable (`view === "active"`) and tab count logic (`activeRequests`) remain unchanged — only the user-facing text is updated.

File to modify: `src/pages/Dashboard.tsx`
- Update the tab button label from `Active ({activeRequests.length})` to `Review ({activeRequests.length})`.