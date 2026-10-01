"""Build short study notes keyed to the original pool's question IDs.

The imported answer labels remain untouched. Notes explain the concept and call
out a few labels whose wording conflicts with standard networking behavior.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
questions = json.loads((ROOT / "questions.json").read_text(encoding="utf-8"))["questions"]
notes = {}


def group(ids, text):
    for number in ids:
        notes[number] = text


# Spanning tree and switch behavior.
group([2, 12, 13, 14, 44], "A root port is a non-root switch's lowest-cost path toward the root bridge.")
group([7, 24, 106], "A designated port is the forwarding port chosen for a network segment; a root port points toward the root bridge.")
group([10, 27, 40, 50, 125], "STP blocks redundant Layer 2 paths so frames cannot circulate endlessly through a loop.")
group([42, 107, 178, 179, 189], "Without loop prevention, redundant switch links can duplicate frames, create broadcast storms, and destabilize MAC learning.")
group([20, 28, 112, 114], "STP elects the lowest bridge ID as root: priority is compared first, then MAC address breaks a tie.")
group([21, 116], "Classic IEEE 802.1D STP uses one spanning-tree instance, so all VLANs share the same root and topology.")
group([3, 38, 101], "PVST+ runs an STP instance per VLAN; Rapid PVST+ adds the faster convergence of RSTP.")
group([17, 19, 153], "MST maps several VLANs to one spanning-tree instance, reducing the number of topologies a switch manages.")
group([26], "After convergence, STP has settled each port into a stable forwarding or blocking role.")
group([30], "A green-and-amber port LED points to a link or port fault; check the interface counters and cable.")
group([36, 41, 128], "A switch learns source MAC addresses while a port is learning and also while it is forwarding; the pool keys one state here.")
group([46], "STP normally runs by default on Cisco switches to protect redundant Layer 2 links from loops.")
group([102, 122, 157, 188], "The bridge ID combines bridge priority, extended system ID, and MAC address for root election.")
group([105], "Pool note: 'cost' is keyed here, but path cost selects routes; standard bridge ID fields are priority, extended system ID, and MAC address.")
group([109, 123], "The root bridge is the reference switch from which every STP path cost is calculated.")
group([110], "RSTP is the rapid-convergence successor to classic IEEE 802.1D spanning tree.")
group([176, 180], "The extended system ID carries the VLAN ID inside the bridge ID's priority field.")
group([197], "Each segment chooses a designated port, while each non-root switch chooses its lowest-cost root port; an alternate is a backup.")
group([129], "A switch separates collision domains by port; a router separates broadcast domains by interface.")
group([32], "An unknown unicast destination is flooded out eligible ports because the switch has not learned where that MAC address lives.")

# EtherChannel and link aggregation.
group([4, 6, 29, 37, 47, 117, 119, 126, 127], "PAgP 'desirable' actively negotiates; 'auto' waits for a peer. The two ends need compatible modes.")
group([8], "Mode 'on' forces an EtherChannel without PAgP or LACP negotiation, so both ends must be set consistently.")
group([11, 35, 113, 161], "PAgP is Cisco's proprietary EtherChannel negotiation protocol; 'auto' and 'desirable' are its modes.")
group([18, 103, 154, 158, 159], "LACP is the open IEEE link-aggregation protocol; active mode starts negotiation and can work across vendors.")
group([1], "The exhibit's negotiation clue points to PAgP, Cisco's proprietary EtherChannel protocol.")
group([5], "A normal EtherChannel groups parallel links to the same peer; ports leading to separate switches cannot form one ordinary bundle.")
group([9], "A routed Layer 3 EtherChannel needs its port-channel interface in routed mode, so switching mode is disabled.")
group([15, 25], "An EtherChannel can keep forwarding across its remaining healthy member links when one member fails.")
group([16, 33, 34, 111, 155], "EtherChannel combines physical links into one logical link, increasing capacity while STP sees a single connection.")
group([22, 43, 118, 181], "A trunk can join an EtherChannel when both ends and every member agree on trunking and allowed VLANs.")
group([23, 45, 121, 124, 198], "Member ports need compatible speed, duplex, VLAN, and trunk settings before they can bundle reliably.")
group([39, 104, 177], "If negotiation or member settings disagree, the port-channel may be down or suspended; compare both peers' modes and configuration.")
group([48, 115], "Configure the logical port-channel interface so its member links inherit consistent settings.")
group([49, 108, 160, 162], "EtherChannel hashes selected source and destination fields to keep each traffic flow on a consistent member link.")
group([120], "The interface port-channel command opens the logical interface where bundle-wide settings are configured.")
group([156], "Pool note: this answer says the bundle stays up, but mismatched access VLANs can suspend members; verify each port's actual state.")

# DHCPv4 messages and addressing.
group([54, 58, 59, 61, 87, 96, 99, 171], "DHCPDISCOVER is the client's broadcast search for a DHCP server before it has an address.")
group([66, 88, 166], "DHCPOFFER is the server's proposed address lease in the discover–offer–request–ack exchange.")
group([77, 80, 85, 130, 151, 164, 165, 174], "DHCPREQUEST accepts an offered lease, or renews an existing lease; its destination depends on the stage.")
group([95, 167], "DHCPACK confirms that the server granted the lease and its configuration parameters.")
group([51, 68, 73, 86, 145, 169], "A home or edge router can be a DHCP client on its WAN interface and receive its address from the ISP.")
group([57], "Exclude reserved addresses before defining the DHCP pool, so the server leases only available host addresses.")
group([64, 74], "DHCP automates host addressing. DHCPv4 uses UDP port 67 at the server and port 68 at the client.")
group([98, 149], "A 169.254.x.x address is self-assigned when DHCPv4 cannot supply a usable lease.")
group([100], "ipconfig /all is a Windows host command; Cisco routers use show commands to inspect addressing.")
group([142, 183, 186], "The excluded-address range reserves the listed IPv4 addresses, so DHCP will not lease them to clients.")
group([146], "DHCPv4 clients use UDP port 68; the server listens on UDP port 67.")
group([152, 191], "show ip dhcp binding lists the IPv4 leases a Cisco DHCP server has assigned to clients.")
group([163], "A DHCP relay forwards client broadcasts to a remote server and can relay several UDP-based services.")
group([195], "Dynamic allocation gives a client an IPv4 address for a lease period rather than reserving it permanently.")

# IPv6, SLAAC, DHCPv6, and first-hop redundancy.
group([52, 72, 76, 137, 138, 141, 168, 182, 193], "In router advertisements, A permits SLAAC, O points to extra stateless DHCPv6 information, and M requests stateful DHCPv6 addressing.")
group([56, 67, 71, 82, 192], "IPv6 routing must be enabled for a router to send useful router advertisements to hosts using SLAAC.")
group([62, 134], "EUI-64 builds an IPv6 interface ID from the interface MAC address, with an inserted FFFE value and a flipped U/L bit.")
group([65], "SLAAC hosts use the router's link-local address as their default gateway, learned from router advertisements.")
group([69, 75, 81, 148, 190], "Stateless DHCPv6 supplies extra settings such as DNS; hosts build their own IPv6 address from the advertised prefix.")
group([70, 94, 139, 172], "A DHCPv6 relay forwards client requests toward a server when the server is on another link; it is not itself the address server.")
group([97, 175], "SLAAC has no server holding address leases; the host forms its own address from router-advertised information.")
group([132], "Duplicate Address Detection sends an ICMPv6 Neighbor Solicitation for the tentative address before using it.")
group([133], "An IPv6 host can create a privacy-friendly interface ID randomly instead of deriving it from the MAC address.")
group([140], "Pool note: the keyed choice conflicts with the usual flags. M=0/O=1 means SLAAC addressing plus extra DHCPv6 information.")
group([143], "On a host, ipconfig /all can show the IPv6 address and related configuration it received.")
group([53], "In a first-hop redundancy group, hosts send frames to the shared virtual router MAC address.")
group([78], "HSRP has an active router that forwards for the virtual gateway and a standby router ready to take over.")
group([83], "GLBP provides a shared gateway while distributing clients across multiple forwarding routers.")
group([60, 90, 150, 170], "Stateful DHCPv6 proceeds through Solicit, Advertise, Request, and Reply messages.")
group([91, 93], "Check received DHCPv6 information on the client; the result depends on whether the interface is actually configured to request it.")
group([63, 135], "A stateless DHCPv6 client gets its address by SLAAC and asks DHCPv6 only for extra settings.")
group([131], "Enabling ipv6 unicast-routing is a router setup step; the exact numbered step depends on the configuration sequence in the pool.")
group([144, 173], "Router advertisement flags reveal whether the router is offering SLAAC, stateless DHCPv6 extras, or stateful DHCPv6 addressing.")

special = {
    55: "Pool note: 80 is keyed here, but DHCP relay traffic normally uses UDP port 67 toward the server; port 80 is HTTP.",
    79: "A /24 has 254 usable host addresses before subtracting any excluded addresses in the prompt.",
    84: "A /25 provides 126 usable host addresses; subtract addresses excluded from the DHCP pool.",
    89: "A /26 provides 62 usable host addresses; subtract the excluded addresses to find leases available.",
    92: "Check the exhibit's actual lease and gateway values; the displayed configuration determines the address the host uses.",
}
notes.update(special)


def derive(question):
    number = int(question["id"])
    if number in notes:
        return notes[number]
    stem = re.sub(r"\s+", " ", question["question"]).lower()
    answer = " · ".join(question["correctAnswers"])
    if "address pool" in stem and answer.isdigit():
        mask = re.search(r"/(\d\d)", stem)
        size = 2 ** (32 - int(mask.group(1))) - 2 if mask else None
        return f"A /{mask.group(1)} has {size} usable host addresses before reserved or excluded addresses are removed." if mask else "Count usable host addresses, then subtract the addresses excluded from the DHCP pool."
    if "excluded-address" in stem:
        return "An excluded range protects reserved addresses from being handed out by the DHCP server."
    if "dhcp" in stem:
        return "Follow the DHCP exchange or configuration shown: the answer identifies the message, lease setting, or address source at this step."
    if "slaac" in stem or "ipv6" in stem or "dhcpv6" in stem:
        return "Use the router advertisement flags and the address source to separate SLAAC from stateful and stateless DHCPv6."
    if "etherchannel" in stem or "channel" in stem or "lacp" in stem or "pagp" in stem:
        return "Check the negotiation mode and matching member-port settings; EtherChannel treats compatible physical links as one logical link."
    if "stp" in stem or "spanning" in stem or "bridge" in stem:
        return "STP chooses a root and port roles from bridge IDs and path costs, then blocks redundant loops."
    return f"The source pool keys “{answer}.” Use the exact wording and exhibit details to distinguish it from the other choices."


result = {str(question["id"]): derive(question) for question in questions}
(ROOT / "explanations.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(result)} short explanations")
