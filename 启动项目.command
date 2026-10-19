#!/bin/zsh
set -e
cd "$(dirname "$0")"
task_python=""
for candidate in "$PWD/.venv/bin/python3" "/Users/nyy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" "$(command -v python3 || true)"; do
  if [[ -x "$candidate" ]] && "$candidate" -c 'import numpy' >/dev/null 2>&1; then
    task_python="$candidate"
    break
  fi
done
if [[ -z "$task_python" ]]; then
  print '需要 Python 3 和 NumPy。请按照 README.md 的安装步骤运行。'
  read 'reply?按回车退出'
  exit 1
fi
print '打开浏览器访问 http://127.0.0.1:8765'
print '关闭服务请按 Control+C。'
"$task_python" server.py --port 8765
