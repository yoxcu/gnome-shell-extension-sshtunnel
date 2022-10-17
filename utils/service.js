function getServiceFile () {
    return '[Unit] \n\
Description=%USER%@%I SSH Tunnel \n\
After=network-online.target ssh.service \n\
\n\
[Service] \n\
User=%USER% \n\
EnvironmentFile=/etc/default/sshtunnel@%i \n\
RestartSec=3 \n\
Restart=always \n\
ExecStartPre=/bin/sh -c \'until ping -c1 $(ssh -G ${TARGET_HOST} | awk \'"\'"\'{if($1=="hostname") print $2}\'"\'"\' ); do sleep 10; done;\'\n\
ExecStart=/usr/bin/ssh -NT -o "ExitOnForwardFailure=yes" $SSH_OPTIONS ${TARGET_HOST} $FORWARDS $REVERSES \n\
TimeoutStopSec=10 \n\
\n\
[Install] \n\
WantedBy=multi-user.target \n';
}

function getTunnelFile () {
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
