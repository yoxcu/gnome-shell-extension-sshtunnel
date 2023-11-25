export function Tunnel(hostname,forwards,reverses,options,user,id=null,enabled=true){
    this.user=user
    this.hostname=hostname;
    this.forwards=forwards;
    this.reverses=reverses;
    this.options=options;
    this.id=id;
    this.enabled=enabled;
}


export function saveTunnel(settings,tunnel){
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    let index = tunnels.findIndex(obj => obj.id ==tunnel.id)
    if (index == -1){
        tunnels.push(tunnel);
    } else {
        tunnels[index]=tunnel;
    }
    let str = stringifyTunnels(tunnels);
    settings.set_strv("tunnels",str);
}

export function getNextTunnelId(settings){
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    if (tunnels.length <=0){
        return 0;
    } else {
        return tunnels[tunnels.length-1].id+1;
    }
}

export function deleteTunnel(settings,tunnel){
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    let id = tunnels.findIndex(obj => obj.id ==tunnel.id)
    tunnels.splice(id, 1); // 2nd parameter means remove one item only
    let str = stringifyTunnels(tunnels);
    settings.set_strv("tunnels",str);
}

export function parseTunnels(str){
    let tunnels = [];
    str.forEach(obj => {
        tunnels.push(JSON.parse(obj));
    });
    return tunnels;
}

export function stringifyTunnels(tunnels){
    let str = [];
    tunnels.forEach(obj => {
        str.push(JSON.stringify(obj));
    });
    return str;
}
