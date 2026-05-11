Follow the instructions in `.agents/workflows/chat-handoff.md` for: $ARGUMENTS

If $ARGUMENTS contains "last" or "read" or "resume", run:
```powershell
Get-ChildItem .agents/handoffs/ | Sort-Object Name | Select-Object -Last 1 | Get-Content
```
and present the contents so the session can resume immediately.
