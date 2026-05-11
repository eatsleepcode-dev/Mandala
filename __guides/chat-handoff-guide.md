


https://dev.azure.com/admindevuk/DelawareUK-Analytics/_git/Data-Platform


https://dev.azure.com/admindevuk/DelawareUK-Analytics/_git/Composable_Data_Platfom?path=%2Fnotebooks%2Futilities%2Fcommon_functions.Notebook&version=GBmain&_a=contents


https://dev.azure.com/admindevuk/DelawareUK-Analytics/_git/Azure_Functions?path=%2F&version=GBmain&_a=contents


https://github.com/onetoomanybi/composable-data-platform



... 


Randon



python scripts/diary/retrospective.py --since 2026-05-01 --until 2026-05-07



https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-schemas#lakehouse-schemas-in-notebook

https://learn.microsoft.com/en-us/rest/api/fabric/lakehouse/items


scripts/deploy_fabric_cli.sh committed	🔁 Carryover → TD-077	Deferred as optional P1-D

The 121 Medium are pre-existing (SQL injection style findings across the wider codebase — separate concern).
The 121 Medium are pre-existing (SQL injection style findings across the wider codebase — separate concern).

## Baseline
- Tests: 1302 passed, 7 skipped
- Ruff: clean
- mypy: 267 pre-existing errors, 44 files (zero new this session)
- bandit: High=0 (3→0 fixed); 121 Medium / 50 Low pre-existing
- gitleaks: clean


Logging / error reporting improvements:
print(f"  → {name:<50s} ✗ FAILED: {str(result['error'])[:100]}") the error is limited to 100 chars currently - I can remove that limit temporarily and see what it returns
 

