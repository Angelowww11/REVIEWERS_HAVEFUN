"""Build the separate CCST midterm deck from the supplied PDF.

Page numbers and corrections below are intentionally explicit so the answer key
can be reviewed without trusting the PDF's yellow highlighting blindly.
"""

from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path

import pdfplumber
from PIL import Image

ROOT = Path(__file__).resolve().parent
PDF = ROOT.parent.parent / "Module" / "CCST Networking Reviewer 1.pdf"
POPPLER = Path(r"C:\Users\angel\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")
EXHIBITS = ROOT / "exhibits"

# Duplicate slides, unsupported/ambiguous items, and the slide whose image is
# missing from the supplied PDF are deliberately left out.
KEY = {
    5: "D", 6: "C", 7: "C", 8: "D", 9: "B", 10: "D", 12: "B", 14: "A",
    16: "A", 21: "D", 25: "C", 26: "B", 28: "B", 29: "BD", 31: "C",
    33: "A", 34: "A", 35: "D", 36: "B", 37: "A", 38: "B", 39: "D",
    42: "A", 43: "C", 45: "C", 46: "A", 47: "C", 55: "A", 56: "D",
    58: "B", 59: "B", 61: "C", 62: "A", 63: "C", 64: "C", 68: "AD",
    71: "AC", 72: "AC", 75: "B", 77: "B", 78: "AC", 79: "D",
    80: "D", 81: "D", 82: "B", 83: "A", 84: "B", 85: "D",
    95: "A", 96: "BE", 97: "B",
}

EXPLANATIONS = {
    5: "255.255.252.0 has 22 network bits. Keep the given host address: 172.16.199.25/22.",
    6: "240 in the final octet has four 1 bits, so the mask is /28.",
    7: "Two full 255 octets contribute 16 network bits.",
    8: "255.255.252.0 is /22, regardless of the host address.",
    9: "A /24 keeps the first three octets fixed at 192.168.200.",
    10: "Remove leading zeros in each group, then compress the single longest run of all-zero groups once.",
    12: "IPv6 link-local unicast addresses use the FE80::/10 range.",
    14: "UDP identifies applications by source and destination port numbers.",
    16: "SFTP uses SSH to protect file transfer; plain HTTP does not provide that secure upload service.",
    21: "show running-config displays the configuration currently active in memory.",
    25: "IPv6 Neighbor Discovery resolves the link-layer address; IPv4 ARP is not used for IPv6.",
    26: "SLAAC uses ICMPv6 Router Advertisements to learn a prefix and default router.",
    28: "tracert displays each hop, helping locate where a path stops responding.",
    29: "Hosts in one subnet use their local router interface as the default gateway; it need not be the first usable address.",
    31: "A host needs a default gateway to send traffic beyond its own VLAN/subnet.",
    33: "A management VLAN interface gives the Layer 2 switch an IP address for remote administration.",
    34: "STP blocks a redundant Layer 2 path so frames cannot loop endlessly.",
    35: "OSPF uses its own packets directly over IP (protocol number 89); Hello packets discover neighbors.",
    36: "A switch learns source MAC addresses on ports and can also hold administrator-configured static entries.",
    37: "The mask separates the network bits from the host bits of an IPv4 address.",
    38: "The default gateway is the next Layer 3 boundary after a working local LAN connection.",
    39: "SSH provides an encrypted remote CLI session where show running-config can be executed.",
    42: "A firewall applies allow and deny rules based on addresses, ports, and sometimes applications.",
    43: "Filtering rules can match source and destination addresses; NAT is a separate function.",
    45: "Confidentiality limits data access to authorized people and systems.",
    46: "Authentication verifies identity; authorization decides permissions; accounting records activity.",
    47: "WPA3 improves authentication between wireless clients and the access point.",
    55: "WPA2-Personal uses a shared passphrase rather than an enterprise authentication server.",
    56: "1000BASE-T runs over twisted-pair Ethernet cabling with RJ-45 connectors.",
    58: "A server shares stored files with users over the network.",
    59: "An SFP is a small removable transceiver inserted into a network-device slot.",
    61: "IEEE 802.11 is the family of Wi-Fi standards; 802.3 is Ethernet.",
    62: "An internet-connected thermostat is an embedded networked device: an IoT endpoint.",
    63: "Fiber carries light rather than electrical signals, so EMI and radio interference do not affect it.",
    64: "A console cable gives local out-of-band access when the network path to the switch is unavailable.",
    68: "RFC 1918 includes 172.16.0.0/12 and 192.168.0.0/16 as private IPv4 ranges.",
    71: "The trace reaches the destination at hop 12. Timeouts at hops 5 and 6 do not mean the path failed.",
    72: "An initial ticket records what failed and when/how it happens; troubleshooting actions come later.",
    75: "A live webinar outage affects an event happening now, giving it the most immediate impact.",
    77: "Checking the iOS Wi-Fi and network settings manually lets you verify the SSID and security configuration.",
    78: "Without the router, VLANs cannot route to each other. PC-A and PC-B remain in VLAN 100 and can still communicate locally.",
    79: "With no destination MAC entry, a Layer 2 switch floods the frame through its other ports in that VLAN.",
    80: "A broadcast is forwarded out every eligible port except the port where it arrived: B, C, and D.",
    81: "On this switch, a blinking green link LED indicates that the link is up and carrying traffic.",
    82: "Alternating green and amber indicates an error condition on the port.",
    83: "The final tracert hop is 192.168.1.10. One intermediate timeout does not mean the destination is unreachable.",
    84: "The # prompt is privileged EXEC mode, where show commands can display system information.",
    85: "MAC entries for several VLANs on Gi0/1 suggest a trunk/uplink to another switch.",
    95: "Traceroute reveals the routers along a path and where responses stop.",
    96: "Ping tests responses from a host; traceroute/tracert also tests reachability while showing the path.",
    97: "A wrong access VLAN can place the user with a different group of devices than intended.",
}

# Crops are PDF slide coordinates (960 x 540). They exclude every marked choice.
CROPS = {
    86: (12, 100, 722, 212),
    59: (405, 150, 950, 440),
    71: (0, 15, 960, 390),
    74: (20, 125, 955, 540),
    78: (180, 68, 900, 390),
    79: (175, 60, 900, 430),
    80: (105, 70, 920, 405),
    83: (65, 128, 905, 395),
    84: (100, 125, 850, 305),
    85: (145, 80, 865, 410),
}

OVERRIDES = {
    5: {"question": "Given IP address 172.16.199.25 and subnet mask 255.255.252.0, what is the CIDR notation?",
        "options": ["172.16.199.25/20", "172.16.199.25/21", "172.16.199.25/23", "172.16.199.25/22"], "correct": ["D"]},
    8: {"question": "A host has IP address 172.16.100.25 and subnet mask 255.255.252.0. What is its CIDR notation?"},
    10: {"question": "What is the shortest valid notation for 2001:0db8:0000:0016:0000:001b:2000:0056?",
         "options": ["2001:db8::16::1b:2000:56", "2001:db8:0:16::1b:2:56", "2001:db8:16::1b:2000:56", "2001:db8:0:16:0:1b:2000:56"], "correct": ["D"]},
    35: {"question": "Which protocol carries OSPF Hello packets used to discover neighbors?",
         "options": ["TCP port 89", "UDP port 89", "ICMP", "OSPF directly over IP (protocol 89)"], "correct": ["D"]},
    39: {"question": "You need to view each Cisco switch's running configuration remotely from a command line. Which protocol should you use?",
         "options": ["FTP", "RDP", "SNMP", "SSH"], "correct": ["D"]},
    71: {"question": "The tracert output reaches www.cisco.com after two intermediate timeouts. Which two conclusions are supported?",
         "options": ["The trace reached the destination server.", "The trace failed after hop 4.", "The destination IPv6 address is 2600:1408:c400:38d::b33.", "Routers at hops 5 and 6 are definitely offline.", "The sending device has address 2600:1408:c400:38d::b33."], "correct": ["A", "C"]},
    78: {"question": "Router1 is temporarily offline. Which two statements about this diagram are true?",
         "options": ["No PC can reach File-Srv in VLAN 16.", "File-Srv can still reach the Internet.", "PC-A and PC-B can still communicate within VLAN 100.", "All four PCs can still communicate across VLANs.", "PC-C and PC-D can still communicate with File-Srv in VLAN 16."], "correct": ["A", "C"]},
    79: {"question": "PC-A sends a frame to PC-C. Switch1 has no MAC-table entry for PC-C. What does Switch1 do?"},
    80: {"question": "A laptop sends a broadcast into port A of the first switch. Which of its labeled ports forward the frame?"},
    83: {"question": "What does this tracert output show about the destination 192.168.1.10?"},
    85: {"question": "What can be inferred from this switch MAC address table?"},
}


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("�", "'").replace("’", "'")).strip()


def parse_slide(text: str):
    lines = [clean(line) for line in text.splitlines() if clean(line)]
    first = next((i for i, line in enumerate(lines) if re.match(r"^[A-E]\.\s*\S", line)), None)
    if first is None:
        raise ValueError(f"No options found: {lines[:3]}")
    question = clean(" ".join(lines[:first]))
    choices: dict[str, str] = {}
    letter = None
    for line in lines[first:]:
        match = re.match(r"^([A-E])\.\s*(.*)", line)
        if match:
            letter = match.group(1)
            choices[letter] = match.group(2)
        elif letter:
            choices[letter] += " " + line
    return question, [clean(value) for value in choices.values()]


def crop_exhibit(page: int) -> str:
    name = f"ccst-page-{page}.png"
    target = EXHIBITS / name
    EXHIBITS.mkdir(exist_ok=True)
    with subprocess.Popen([str(POPPLER), "-f", str(page), "-l", str(page), "-r", "144", "-singlefile", "-png", str(PDF), str(target.with_suffix(""))], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as process:
        if process.wait() != 0:
            raise RuntimeError(f"Could not render PDF page {page}")
    image = Image.open(target).convert("RGB")
    image = image.crop(tuple(round(value * 2) for value in CROPS[page]))
    image.save(target, optimize=True)
    return name


def main():
    if not PDF.exists():
        raise SystemExit(f"Source PDF not found: {PDF}")
    questions = []
    explanations = {}
    seen = set()

    def add(page: int, question: str, options: list[str], correct: list[str], explanation: str, image: str | None = None):
        question = clean(question)
        options = [clean(choice) for choice in options]
        if not question or len(options) < 2 or len(set(options)) != len(options) or not set(correct).issubset(options):
            raise ValueError(f"Invalid question on page {page}: {question}")
        signature = re.sub(r"[^a-z0-9]", "", question.lower())
        if signature in seen:
            raise ValueError(f"Duplicate question on page {page}: {question}")
        seen.add(signature)
        item_id = len(questions) + 1
        markup = (f'<p><img src="exhibits/{image}" alt="Exhibit from CCST reviewer page {page}"></p>' if image else "") + f"<p>{html.escape(question)}</p>"
        section = "Concepts" if page < 40 else "Security" if page < 53 else "Endpoints" if page < 65 else "Infrastructure" if page < 69 else "Diagnostics"
        questions.append({"id": item_id, "sourceFile": f"CCST · {section}", "sourcePage": page,
                          "type": "true_false_question" if options == ["True", "False"] else "multiple_choice_question", "question": question,
                          "questionHtml": markup, "options": options, "correctAnswers": correct})
        explanations[str(item_id)] = explanation

    def add_tf_group(page: int, statements: list[tuple[str, str, str]], image: str | None = None):
        question = "For each statement, choose True or False."
        image_markup = f'<p><img src="exhibits/{image}" alt="Exhibit from CCST reviewer page {page}"></p>' if image else ""
        item_id = len(questions) + 1
        section = "Concepts" if page < 40 else "Diagnostics"
        questions.append({"id": item_id, "sourceFile": f"CCST · {section}", "sourcePage": page,
                          "type": "true_false_group", "question": question,
                          "questionHtml": image_markup + f"<p>{html.escape(question)}</p>",
                          "statements": [text for text, _, _ in statements], "options": ["True", "False"],
                          "correctAnswers": [answer for _, answer, _ in statements]})
        explanations[str(item_id)] = "\n".join(f"{index + 1}. {answer} — {explanation}" for index, (_, answer, explanation) in enumerate(statements))

    with pdfplumber.open(PDF) as pdf:
        for page, letters in KEY.items():
            question, options = parse_slide(pdf.pages[page - 1].extract_text(x_tolerance=2, y_tolerance=2) or "")
            override = OVERRIDES.get(page, {})
            question = override.get("question", question)
            options = override.get("options", options)
            letter_list = override.get("correct", list(letters))
            correct = [options[ord(letter) - ord("A")] for letter in letter_list]
            image = crop_exhibit(page) if page in CROPS else None
            add(page, question, options, correct, EXPLANATIONS[page], image)

    add_tf_group(22, [
        ("High levels of network latency decrease network bandwidth.", "False", "Latency is delay; it does not change rated bandwidth capacity."),
        ("Low bandwidth can increase network latency.", "True", "A low-capacity link can add transmission and queuing delay under load."),
        ("You can increase throughput by decreasing network latency.", "True", "Reducing latency can improve achieved throughput, especially for traffic that needs acknowledgements.")
    ])
    add_tf_group(86, [
        ("A device connected to GigabitEthernet0/1 can send out broadcast traffic.", "False", "The exhibit shows the interface down/down, so it cannot forward frames."),
        ("A technician issued the shutdown command on interface GigabitEthernet0/2.", "True", "Administratively down means the interface was disabled in configuration."),
        ("A technician set the IP address for GigabitEthernet0/0 by using the CLI.", "True", "The Method column shows manual for GigabitEthernet0/0.")
    ], crop_exhibit(86) if 86 in CROPS else None)

    # The PDF's drag-and-drop and true/false slides become ordinary cards so
    # every existing mode can use them, including live rooms and mobile.
    extras = [
        (13, "At which OSI layer is a data stream split into segments with source and destination port numbers?", ["Network", "Session", "Transport", "Data Link"], "Transport", "Segmentation and port numbers are functions of OSI Layer 4, the transport layer."),
        (15, "Which OSI layer adds MAC addresses and a trailer for frame error detection during encapsulation?", ["Network", "Session", "Transport", "Data Link"], "Data Link", "Layer 2 adds the Ethernet header and frame check sequence trailer."),
        (17, "Which protocol uses SSH on port 22 for secure file transfer?", ["SFTP", "TFTP", "DNS", "DHCP"], "SFTP", "SFTP runs over SSH and protects the transfer."),
        (17, "Which protocol uses UDP port 69 for small unauthenticated file transfers?", ["SFTP", "TFTP", "ICMP", "DNS"], "TFTP", "TFTP is the simple UDP-based file transfer protocol."),
        (17, "Which protocol resolves a domain name to an IP address?", ["DNS", "DHCP", "SFTP", "ICMP"], "DNS", "DNS maps human-readable domain names to addresses."),
        (17, "Which protocol can reserve and assign an IP address to a server?", ["DNS", "DHCP", "ICMP", "TFTP"], "DHCP", "A DHCP reservation maps a device to an assigned IP address."),
        (17, "Which protocol does ping use to test whether a host responds?", ["ICMP", "TFTP", "DNS", "SFTP"], "ICMP", "Ping uses ICMP Echo Request and Echo Reply messages."),
        (18, "Which OSI layer handles TCP and UDP?", ["Application", "Transport", "Network", "Physical"], "Transport", "TCP and UDP provide transport-layer delivery and port numbers."),
        (18, "Which OSI layer contains switches and Ethernet frames?", ["Physical", "Data Link", "Network", "Application"], "Data Link", "Ethernet switching uses Layer 2 MAC addresses and frames."),
        (19, "Which TCP/IP model layer contains IP?", ["Application", "Transport", "Internet", "Network Access"], "Internet", "IP provides internetwork addressing and routing."),
        (20, "Which network type usually covers personal devices within about 10 meters?", ["PAN", "LAN", "MAN", "WAN"], "PAN", "A personal area network links devices near one person."),
        (20, "Which network type spans a large geographic distance and connects smaller networks?", ["PAN", "LAN", "WAN", "WLAN"], "WAN", "A wide area network connects sites across long distances."),
        (23, "A company develops an app using cloud-hosted development tools. Which model is this?", ["IaaS", "PaaS", "SaaS", "On-premises"], "PaaS", "Platform as a Service supplies the tools and runtime for app development."),
        (23, "A user pays monthly for a browser-based graphics app. Which model is this?", ["IaaS", "PaaS", "SaaS", "Private cloud"], "SaaS", "Software as a Service delivers the finished application online."),
        (24, "Cloud virtual machines and virtual storage are examples of which model?", ["IaaS", "PaaS", "SaaS", "WLAN"], "IaaS", "Infrastructure as a Service provides virtual compute, networking, and storage."),
        (44, "Can a network firewall block traffic to specific ports on internal computers?", ["True", "False"], "True", "A firewall rule can permit or deny traffic based on destination port."),
        (44, "Can a network firewall by itself prevent an app from running on a computer?", ["True", "False"], "False", "A network firewall filters traffic; application execution control belongs on the endpoint."),
        (48, "A digital signature primarily supports which CIA principle?", ["Availability", "Integrity", "Confidentiality", "Redundancy"], "Integrity", "A signature helps detect tampering and authenticate the signer."),
        (48, "Encrypting a sensitive email primarily supports which CIA principle?", ["Availability", "Integrity", "Confidentiality", "Accounting"], "Confidentiality", "Encryption helps prevent unauthorized readers from seeing the message."),
        (48, "Three redundant web servers primarily support which CIA principle?", ["Availability", "Integrity", "Confidentiality", "Authentication"], "Availability", "Redundancy keeps the service reachable if one server fails."),
        (49, "A password is which MFA factor?", ["Knowledge", "Possession", "Inherence", "Location"], "Knowledge", "A password is something you know."),
        (49, "A one-time code sent to your phone is which MFA factor?", ["Knowledge", "Possession", "Inherence", "Accounting"], "Possession", "Receiving the code shows possession of the registered device."),
        (49, "Face recognition is which MFA factor?", ["Knowledge", "Possession", "Inherence", "Authorization"], "Inherence", "Biometrics use a physical trait: something you are."),
        (50, "Which older Wi-Fi security scheme could use a 40-bit key?", ["WEP", "WPA2-Personal", "WPA-Enterprise", "WPA3"], "WEP", "WEP supported 40-bit secret keys and is obsolete/insecure."),
        (50, "Which wireless security mode uses a RADIUS authentication server?", ["WEP", "WPA2-Personal", "WPA-Enterprise", "Open"], "WPA-Enterprise", "Enterprise Wi-Fi authenticates users through a RADIUS-backed service."),
        (51, "Which feature should be disabled to prevent push-button Wi-Fi joining?", ["SSID broadcast", "WPS", "WPA2-PSK", "DHCP"], "WPS", "Wi-Fi Protected Setup includes the push-button connection method."),
        (51, "Which wireless mode should be selected when clients connect using a shared passphrase?", ["WPA2-PSK", "WPA-Enterprise", "WEP open authentication", "802.1Q"], "WPA2-PSK", "PSK means pre-shared key, the passphrase used in WPA2-Personal."),
        (67, "Which cable type usually connects a switch Ethernet port to a router Ethernet port?", ["Straight-through UTP", "Crossover UTP", "Coaxial", "Serial"], "Straight-through UTP", "Unlike-device Ethernet ports conventionally use a straight-through patch cable."),
        (67, "Which medium is suitable for the diagram's underground connection between two routers?", ["Straight-through UTP", "Fiber optic", "Console cable", "RJ-11"], "Fiber optic", "Fiber supports long-distance links and resists electrical interference."),
        (67, "Which traditional UTP cable type connects two router Ethernet interfaces directly?", ["Straight-through UTP", "Crossover UTP", "Console cable", "Coaxial"], "Crossover UTP", "A crossover cable traditionally connects like Ethernet devices directly; auto-MDI/MDIX may remove this need."),
        (74, "The diagram shows network 172.100.0.0/16, router 172.100.0.1, and DNS server 172.100.0.254. Which settings should PC-A use?", ["IP 172.100.0.10, mask 255.255.0.0, gateway 172.100.0.1, DNS 172.100.0.254", "IP 172.100.0.1, mask 255.255.0.0, gateway 172.100.0.10, DNS 172.100.0.254", "IP 10.10.100.10, mask 255.255.255.0, gateway 172.100.0.1, DNS 172.100.0.254", "IP 172.100.0.10, mask 255.255.255.0, gateway 10.10.100.254, DNS 172.100.0.254"], "IP 172.100.0.10, mask 255.255.0.0, gateway 172.100.0.1, DNS 172.100.0.254", "The PC needs an unused address in 172.100.0.0/16, its local router as gateway, and the shown DNS server."),
        (88, "The DNS server is 64.100.8.8. Which command shows the path from this PC to that server?", ["tracert 64.100.8.8", "nslookup 64.100.8.8", "ipconfig /renew", "netstat -a"], "tracert 64.100.8.8", "tracert displays the network hops toward the DNS server."),
        (89, "For HTTPS traffic to www.companypro.net:7100/api, which Wireshark display filter selects the TCP port?", ["tcp.port == 7100", "udp.port == 53", "tcp.port == 80", "icmp"], "tcp.port == 7100", "The URL explicitly uses HTTPS over TCP port 7100; packet contents remain encrypted."),
        (90, "The PC's default gateway is 192.168.0.1. Which command checks if the router responds?", ["ping 192.168.0.1", "ping 8.8.8.8", "nslookup companypro.net", "ipconfig /release"], "ping 192.168.0.1", "Ping the local gateway shown in ipconfig to check reachability."),
        (91, "Which command lists IP addresses associated with www.companypro.net?", ["nslookup www.companypro.net", "tracert www.companypro.net", "ipconfig /all", "netstat -r"], "nslookup www.companypro.net", "nslookup queries DNS for the host's address records."),
        (94, "Which Cisco command displays neighboring devices with Device ID, Local Interface, and Platform columns?", ["show cdp neighbors", "show ip route", "show running-config", "show mac address-table"], "show cdp neighbors", "CDP neighbor output lists discovered Cisco devices and their local ports."),
    ]
    for page, question, options, correct, explanation in extras:
        add(page, question, options, [correct], explanation, crop_exhibit(page) if page == 74 else None)

    # All questions and Practice path follow the reviewer's page order.
    questions.sort(key=lambda item: (item["sourcePage"], item["id"]))
    ordered_explanations = {}
    for new_id, item in enumerate(questions, 1):
        ordered_explanations[str(new_id)] = explanations[str(item["id"])]
        item["id"] = new_id
    explanations = ordered_explanations

    payload = {"title": "CCST Networking Midterm Certification Review", "sourceFiles": [PDF.name],
               "sourceSlideCount": 99, "questionCount": len(questions), "questions": questions}
    (ROOT / "ccst-questions.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "ccst-explanations.json").write_text(json.dumps(explanations, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(questions)} questions with {len(EXPLANATIONS)} keyed slides and {len(extras)} converted cards.")


if __name__ == "__main__":
    main()
