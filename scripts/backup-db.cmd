@echo off
chcp 65001 >nul
REM Wrapper du backup nocturne CanalCup (lance par le Planificateur de taches Windows)
cd /d "C:\Users\vtrouillat\Documents\CanalCup"
"C:\Program Files\nodejs\node.exe" scripts\backup-db.js >> backups\backup.log 2>&1
