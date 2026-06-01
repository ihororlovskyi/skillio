import { defineCommand } from 'citty';

const BASH = `# skillio bash completion
# Install: source <(skl completion bash)
_skillio_completions() {
  local cur prev words cword
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  local cmds="list ls remove rm cost cs cst usage us usg completion"
  if [ "\${COMP_CWORD}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${cmds} -h --help -v --version" -- "\${cur}") )
    return 0
  fi

  local sub="\${COMP_WORDS[1]}"
  case "\${sub}" in
    rm|remove)
      if [[ "\${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "-g --global --dry-run -y --yes --force-lock -fl --lock-only -h --help" -- "\${cur}") )
      else
        local names
        local scope=""
        for w in "\${COMP_WORDS[@]}"; do
          if [ "\${w}" = "-g" ] || [ "\${w}" = "--global" ]; then scope="-g"; fi
        done
        names="$(skl list --names \${scope} 2>/dev/null)"
        COMPREPLY=( $(compgen -W "\${names}" -- "\${cur}") )
      fi
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return 0
      ;;
  esac
}
complete -F _skillio_completions skl
complete -F _skillio_completions skillio
`;

const ZSH = `# skillio zsh completion
# Install: source <(skl completion zsh)
_skillio() {
  local -a cmds
  cmds=(
    'list:List skills per source'
    'ls:Alias for list'
    'remove:Delete on-disk skill dirs'
    'rm:Alias for remove'
    'cost:Show ambient ballast cost'
    'cs:Alias for cost'
    'cst:Alias for cost'
    'usage:Show skill usage'
    'us:Alias for usage'
    'usg:Alias for usage'
    'completion:Print shell completion script'
  )
  if (( CURRENT == 2 )); then
    _describe 'command' cmds
    return
  fi
  local sub=\${words[2]}
  case $sub in
    rm|remove)
      if [[ \${words[CURRENT]} == -* ]]; then
        _values 'flag' \\
          '-g[global scope]' '--global[global scope]' \\
          '--dry-run[print plan without deleting]' \\
          '-y[skip confirmation]' '--yes[skip confirmation]' \\
          '--force-lock[also remove lock entry]' '-fl[alias for --force-lock]' \\
          '--lock-only[remove only lock entry, keep disk]'
      else
        local scope=""
        for w in \${words[@]}; do
          if [[ $w == "-g" || $w == "--global" ]]; then scope="-g"; fi
        done
        local -a names
        names=(\${(f)"$(skl list --names \$scope 2>/dev/null)"})
        compadd -- \$names
      fi
      ;;
    completion)
      _values 'shell' bash zsh fish
      ;;
  esac
}
compdef _skillio skl skillio
`;

const FISH = `# skillio fish completion
# Install: skl completion fish | source
function __skillio_skill_names
  set -l scope ""
  for w in (commandline -opc)
    if test "$w" = "-g" -o "$w" = "--global"
      set scope "-g"
    end
  end
  skl list --names $scope 2>/dev/null
end

function __skillio_needs_command
  set -l cmd (commandline -opc)
  test (count $cmd) -le 1
end

function __skillio_using_subcommand
  set -l cmd (commandline -opc)
  if test (count $cmd) -lt 2; return 1; end
  test "$cmd[2]" = "$argv[1]"
end

complete -c skl -n __skillio_needs_command -a 'list ls remove rm cost cs cst usage us usg completion'
complete -c skillio -n __skillio_needs_command -a 'list ls remove rm cost cs cst usage us usg completion'

for sub in rm remove
  complete -c skl -n "__skillio_using_subcommand $sub" -f -a '(__skillio_skill_names)'
  complete -c skillio -n "__skillio_using_subcommand $sub" -f -a '(__skillio_skill_names)'
  complete -c skl -n "__skillio_using_subcommand $sub" -s g -l global -d 'Use global scope'
  complete -c skl -n "__skillio_using_subcommand $sub" -l dry-run -d 'Print plan without deleting'
  complete -c skl -n "__skillio_using_subcommand $sub" -s y -l yes -d 'Skip confirmation prompt'
  complete -c skl -n "__skillio_using_subcommand $sub" -l force-lock -d 'Also remove lock entry'
  complete -c skl -n "__skillio_using_subcommand $sub" -o fl -d 'Alias for --force-lock'
  complete -c skl -n "__skillio_using_subcommand $sub" -l lock-only -d 'Remove only lock entry, keep disk'
end

for sub in completion
  complete -c skl -n "__skillio_using_subcommand $sub" -f -a 'bash zsh fish'
  complete -c skillio -n "__skillio_using_subcommand $sub" -f -a 'bash zsh fish'
end
`;

export const completionCommand = defineCommand({
  meta: {
    description: 'Print shell completion script (bash, zsh, fish)',
  },
  args: {
    shell: {
      type: 'positional',
      required: true,
      description: 'Target shell: bash, zsh, or fish',
    },
  },
  run({ args }) {
    const shell = String((args as { shell?: string }).shell ?? '');
    switch (shell) {
      case 'bash':
        process.stdout.write(BASH);
        return;
      case 'zsh':
        process.stdout.write(ZSH);
        return;
      case 'fish':
        process.stdout.write(FISH);
        return;
      default:
        console.error(`unknown shell: ${shell || '(none)'} — supported: bash, zsh, fish`);
        process.exit(1);
    }
  },
});
