import GLib from 'gi://GLib';
const Bytes  = imports.byteArray

export function updateServiceState(tunnel){
    if (tunnel.enabled){
        return runCmd(getStartServiceCmd(tunnel))
    } else {
        return runCmd(getStopServiceCmd(tunnel))
    }
}

export function updateServiceStateAsync(tunnel){
    if (tunnel.enabled){
        return runCmdAsync(getStartServiceCmd(tunnel))
    } else {
        return runCmdAsync(getStopServiceCmd(tunnel))
    }
}

export function getRestartServiceCmd(tunnel){
    return 'systemctl restart --no-block sshtunnel.' + tunnel.user + '@' + tunnel.id + '.service; ';
}

export function getStartServiceCmd(tunnel){
    return 'systemctl enable --now --no-block sshtunnel.' + tunnel.user + '@' + tunnel.id + '.service; ';
}

export function getStopServiceCmd(tunnel){
    return 'systemctl disable --now --no-block sshtunnel.' + tunnel.user + '@' + tunnel.id + '.service; ';
}

export function runCmd(cmd){
    let [ok, out, err, exit] = safeSpawn(`pkexec sh -c "${cmd}"`);
    return exit == 0;
}

export function runCmdAsync(cmd){
    return GLib.spawn_command_line_async(`sh -c "${cmd}"`);
}

export function getServicesState(services) {
    let [ok, out, err, exit] = safeSpawn(["systemctl","is-failed", ...services].filter(item => !!item).join(" "))
    out = Bytes.toString(out)
    return out.split('\n').filter(item => !!item)
    //return out.split('\n').filter(item => !!item).reduce(
    //    (all, value, idx) => ({ ...all, [services[idx]]: value }), {}
    //);
}

export function safeSpawn(cmd) {
  try {
    return GLib.spawn_command_line_sync(cmd)
  } catch (e) {
    return [false, Bytes.fromString(''), null, null]
  }
}

export function getServiceFile () {
    return '[Unit] \n\
Description=%USER%@%I SSH Tunnel \n\
After=network-online.target ssh.service \n\
\n\
[Service] \n\
User=%USER% \n\
EnvironmentFile=/etc/default/sshtunnel@%i \n\
RestartSec=3 \n\
Restart=always \n\
ExecStartPre=/bin/sh -c \'until ping -q -c1 $(ssh -G -T ${TARGET_HOST} | awk \'"\'"\'{if($1=="hostname") print $2}\'"\'"\' ) 2>&1 >/dev/null && echo "Server reachable!"; do sleep 10; done;\'\n\
ExecStart=/usr/bin/ssh -NT -o "ExitOnForwardFailure=yes" $SSH_OPTIONS ${TARGET_HOST} $FORWARDS $REVERSES \n\
TimeoutStopSec=10 \n\
\n\
[Install] \n\
WantedBy=multi-user.target \n';
}

export function getTunnelFile () {
return '# Options for sshtunnel.user@host1.service \n\
# Place it at /etc/default \n\
\n\
# Save all your credential/user/port related config in ~/.ssh/config is strongly recommanded \n\
# Leave hostname here only \n\
TARGET_HOST=%HOSTNAME% \n\
\n\
# -L LOCALPORT:IP_ON_EXAMPLE_COM:PORT_ON_EXAMPLE_COM \n\
# can set multiple forwardings here \n\
FORWARDS= %FORWARDS% \n\
\n\
# -R PORT_ON_EXAMPLE_COM:IP_ON_EXAMPLE_COM:localport \n\
# can set multiple forwardings here \n\
REVERSES= %REVERSES% \n\
\n\
# === Settings below for ADVANCED users only === \n\
\n\
SSH_OPTIONS= %OPTIONS% \n';
}
