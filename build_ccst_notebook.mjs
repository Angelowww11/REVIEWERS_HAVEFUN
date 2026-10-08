import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE = __dirname;
const SOURCE = path.resolve(SITE, '../../CCST_Networking_Reviewer_Notebook_Detailed-2.html');
const exhibitDir = path.join(SITE, 'exhibits');
const raw = fs.readFileSync(SOURCE, 'utf8');
const marker = 'const D=';
const start = raw.indexOf(marker);
if (start < 0) throw new Error('Reviewer question data was not found.');
let i = start + marker.length, depth = 0, quote = '', escaped = false;
for (; i < raw.length; i++) {
  const ch = raw[i];
  if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; continue; }
  if (ch === '"' || ch === "'") quote = ch;
  else if (ch === '[') depth++;
  else if (ch === ']' && --depth === 0) break;
}
const sections = JSON.parse(raw.slice(start + marker.length, i + 1));
const dropPages = new Set([11, 25, 28, 31, 77, 94, 99]);
const pageNotes = {
  5: 'The source has a typo in the host address and highlights a wrong prefix. The supplied mask has 22 one-bits, so keep the stated host address and use /22.',
  8: '255.255.252.0 has 22 one-bits, so the prefix is /22.',
  27: 'SLAAC uses ICMPv6 Router Solicitation/Advertisement messages. DHCPv6 is a separate, stateful address-configuration option; TFTP transfers files.',
  36: 'OSPF neighbors discover one another with Hello packets. OSPF is carried directly over IP protocol 89; the source answer choices had a broken label, so they were repaired.',
  45: 'A firewall can block traffic by port and can forward traffic when a destination-NAT or port-forwarding rule is configured. Blocking an application from running is an endpoint-control function.',
  50: 'The source says “Inference”; the correct name is inherence, a biometric factor (“something you are”).',
  52: 'The notebook notes the first and third labels are swapped. The corrected actions are disable WPS for push-button access and disable SSID broadcasting to hide the network name.',
  61: 'The referenced switch exhibit was missing. This version asks about the PoE-capable port function rather than a numbered port that cannot be identified without that picture.',
  72: 'The trace reaches its destination at hop 12. The timeouts at hops 5 and 6 only show that those hops did not answer; intermediate routers often filter or deprioritize traceroute probes.',
  79: 'With Router1 offline, VLANs 100 and 110 cannot route to one another. PC-A and PC-B remain in the same local VLAN and subnet, so they can still communicate.',
  80: 'The destination MAC is unknown, so the Layer 2 switch floods the frame in that VLAN out eligible ports except the incoming port Gi0/1.',
  81: 'The laptop sends a broadcast into Switch 1 on port A; Switch 2 is connected to port D. A switch forwards a broadcast out B, C, and D.',
  84: 'The final traceroute hop is 192.168.1.10, so the destination is reachable. A timeout at one intermediate hop does not mean later traffic failed.',
  85: 'The router1# prompt is privileged EXEC mode. It can run show commands; enter global or interface configuration mode to change settings.',
  86: 'Gi0/1 has dynamically learned MAC addresses from multiple VLANs, which is consistent with a switch trunk/uplink.',
  87: 'GigabitEthernet0/1 is down/down and cannot currently send traffic; Gi0/2 is administratively down; Gi0/0 has a manually configured address.',
  88: 'The shown running configuration only identifies two interface sections. Nothing shown assigns IP addresses or shuts the ports down; default switchports belong to VLAN 1.',
  89: 'The ipconfig output lists the DNS server as 64.100.8.8. Tracert to that address displays the path to the resolver.',
  90: 'The URL specifies TCP port 7100. tcp.port == 7100 is a Wireshark display filter for packets using that port.',
  91: 'The default gateway shown is 192.168.0.1. Ping that address to check whether the router responds.',
  95: 'The output columns (Device ID, local interface, holdtime, capability, platform, remote port ID) are shown by show cdp neighbors.'
};
const replacements = {
  1: { options: ['172.16.199.25/20', '172.16.199.25/21', '172.16.199.25/23', '172.16.199.25/22'], correct: [3] },
  18: { question: 'A secure file transfer uses SSH keys and TCP port 22. Which protocol provides this service?', options: ['SFTP', 'TFTP', 'DNS', 'ICMP'], correct: [0] },
  19: { question: 'Which device operates at the OSI Data Link layer to forward frames using MAC addresses?', options: ['Router', 'Switch', 'Hub', 'DNS server'], correct: [1] },
  20: { question: 'In the four-layer TCP/IP model, which layer includes Ethernet?', options: ['Application', 'Transport', 'Internet', 'Network Access'], correct: [3] },
  21: { question: 'Which network type typically connects personal devices over a short range, such as a phone and Bluetooth headset?', options: ['WAN', 'PAN', 'MAN', 'CAN'], correct: [1] },
  23: { question: 'True or False: Increasing a link’s latency by itself changes its rated bandwidth.', options: ['True', 'False'], correct: [1] },
  24: { question: 'A user pays monthly to use a hosted graphics-design app in a web browser. Which cloud service model is this?', options: ['IaaS', 'PaaS', 'SaaS', 'On-premises'], correct: [2] },
  45: { question: 'Which action can a network firewall directly perform using a traffic rule?', options: ['Block traffic to a specified port', 'Prevent a user from launching an app on their PC', 'Repair a damaged cable', 'Change an endpoint password'], correct: [0] },
  49: { question: 'A digital signature used to detect unauthorized changes to a message supports which CIA security principle?', options: ['Availability', 'Confidentiality', 'Integrity', 'Authentication'], correct: [2] },
  50: { question: 'A one-time security code sent to a phone is which authentication factor?', options: ['Knowledge', 'Possession', 'Inherence', 'Location'], correct: [1] },
  51: { question: 'Which wireless security mode commonly authenticates users through a RADIUS server?', options: ['WEP', 'WPA2-Personal', 'WPA-Enterprise', 'Open authentication'], correct: [2] },
  52: { question: 'Which home-router setting disables the push-button connection method?', options: ['Disable WPS', 'Disable DHCP', 'Hide the SSID', 'Enable port forwarding'], correct: [0] },
  61: { question: 'Which Ethernet port feature can deliver both network data and electrical power to an IP phone over one cable?', options: ['PoE-capable switch port', 'Console port', 'SFP uplink only', 'USB management port'], correct: [0] },
  68: { question: 'In the rack diagram, which cable type is appropriate for the link between the two routers over the underground conduit?', options: ['Straight-through UTP', 'Crossover UTP', 'Fiber-optic cable', 'RJ-11 telephone cable'], correct: [2] },
  75: { question: 'The diagram shows PC-A on 172.100.0.0/16, Router1 at 172.100.0.1, and a server at 172.100.0.254. With no DHCP server, which PC-A configuration is valid?', options: ['IP 172.100.0.1, mask 255.255.0.0, gateway 172.100.0.254', 'IP 172.100.0.10, mask 255.255.0.0, gateway 172.100.0.1', 'IP 172.100.0.254, mask 255.255.255.0, gateway 172.100.0.10', 'IP 172.100.1.1, mask 255.255.255.0, no gateway'], correct: [1] },
  81: { question: 'A laptop sends a broadcast into Switch 1 on port A. Switch 2 connects to port D on Switch 1. Which Switch 1 ports forward the broadcast?', options: ['D only', 'A, B, and D only', 'B and C only', 'B, C, and D only'], correct: [3] },
  85: { question: 'At the Cisco router prompt router1#, which action is available in privileged EXEC mode?', options: ['Run show commands such as show running-config', 'Enter interface subcommands without selecting an interface', 'Change an interface address without entering configuration mode', 'Use user EXEC mode only'], correct: [0] },
  87: { question: 'The exhibit shows show ip interface brief. Which statement is true?', options: ['Gi0/1 is up/up and forwarding broadcasts.', 'Gi0/2 has a manually configured IP address.', 'Gi0/2 is administratively down.', 'Gi0/0 is administratively down.'], correct: [2] },
  88: { question: 'A new switch’s running configuration lists interface GigabitEthernet0/1 and 0/2 with no other settings. What can you conclude from the shown lines?', options: ['Both ports were shut down.', 'Both ports have manually assigned IP addresses.', 'The shown configuration does not indicate shutdown or assigned IP addresses.', 'The switch has no Layer 2 ports.'], correct: [2] },
  89: { question: 'The PC’s DNS server is 64.100.8.8. Which command shows the router hops on the path to that DNS server?', options: ['ipconfig /all', 'ping 64.100.8.8', 'tracert 64.100.8.8', 'nslookup 64.100.8.8'], correct: [2] },
  90: { question: 'A web application uses https://www.companypro.net:7100/api. Which Wireshark display filter selects TCP packets using that port?', options: ['tcp.port == 7100', 'dns.port == 7100', 'ip.addr == 7100', 'http.host == 7100'], correct: [0] },
  91: { question: 'A PC has IPv4 address 192.168.0.14/24 and default gateway 192.168.0.1. Which command checks whether the gateway responds?', options: ['ping 192.168.0.1', 'nslookup 192.168.0.1', 'tracert 8.8.8.8', 'ipconfig /renew'], correct: [0] },
  92: { question: 'Which command queries DNS for the IPv4 addresses associated with www.companypro.net?', options: ['ipconfig www.companypro.net', 'nslookup www.companypro.net', 'ping /dns www.companypro.net', 'tracert www.companypro.net'], correct: [1] },
  95: { question: 'Which Cisco IOS command displays the neighbor table shown in the exhibit?', options: ['show ip route', 'show mac address-table', 'show cdp neighbors', 'show interfaces status'], correct: [2] }
};
const supplemental = [
  ['Standards & Concepts','What does network throughput measure?',['The maximum theoretical capacity of a link','The amount of data successfully transferred over time','The physical cable length','The number of addresses in a subnet'],'The amount of data successfully transferred over time','Bandwidth describes capacity; throughput is the achieved data-transfer rate.'],
  ['Standards & Concepts','Which DNS record type maps a host name to an IPv6 address?',['A','AAAA','MX','CNAME'],'AAAA','An AAAA record stores an IPv6 address; an A record stores IPv4.'],
  ['Standards & Concepts','In DHCP’s DORA exchange, what does a client send first when requesting a lease?',['Discover','Offer','Request','Acknowledge'],'Discover','The client broadcasts Discover; a server may then Offer, the client Requests, and the server Acknowledges.'],
  ['Addressing','Which address is a public IPv4 address?',['10.20.30.40','172.20.5.6','192.168.10.5','8.8.8.8'],'8.8.8.8','The other choices are inside RFC 1918 private ranges. 8.8.8.8 is a publicly routable address.'],
  ['Addressing','A Windows PC self-assigns an address in 169.254.0.0/16. What is the most likely explanation?',['It did not receive a DHCP lease','It is using the IPv6 loopback','It has a public address','The DNS server assigned it'],'It did not receive a DHCP lease','Windows uses an IPv4 link-local/APIPA address when it cannot obtain a DHCP lease.'],
  ['Addressing','What does the IPv6 address ::1 represent?',['The default route','The loopback address','A link-local gateway','A multicast group'],'The loopback address','::1 is the IPv6 loopback address, equivalent in purpose to IPv4 127.0.0.1.'],
  ['Endpoints & Media','Which connector is commonly used with fiber-optic links in local-area network equipment?',['RJ-11','LC fiber connector','BNC coaxial connector','USB-A'],'LC fiber connector','LC is a small form-factor fiber connector commonly used with optical transceivers.'],
  ['Endpoints & Media','Compared with 5 GHz Wi-Fi, 2.4 GHz Wi-Fi generally offers which tradeoff?',['Shorter range and less interference','Longer range but often more interference','No radio interference','Wired-level latency'],'Longer range but often more interference','2.4 GHz often reaches farther and penetrates walls better, but it has fewer channels and more sources of interference.'],
  ['Endpoints & Media','What is the main purpose of Power over Ethernet (PoE)?',['Carry electrical power and data over Ethernet cabling','Convert IPv4 addresses to IPv6','Encrypt a Wi-Fi password','Connect two fiber strands'],'Carry electrical power and data over Ethernet cabling','PoE lets a switch or injector power devices such as phones and access points over the network cable.'],
  ['Infrastructure','How does a Layer 2 switch learn which port leads to a device?',['It records the source MAC address of an arriving frame','It reads the destination IP address in DNS','It sends every frame to the router first','It learns only from DHCP offers'],'It records the source MAC address of an arriving frame','The switch associates a frame’s source MAC address and VLAN with the ingress port in its MAC table.'],
  ['Infrastructure','What does a router primarily use to choose where to forward an IP packet?',['The destination IP address and its routing table','The source application name only','The Ethernet cable color','A DNS MX record'],'The destination IP address and its routing table','A router compares the destination IP to routes and forwards toward the best matching route.'],
  ['Diagnosing Problems','Which protocol does the common ping utility use for its echo request and reply?',['ICMP','FTP','ARP only','SMTP'],'ICMP','Ping tests IP reachability with ICMP Echo Request and Echo Reply messages.'],
  ['Diagnosing Problems','What does tracert/traceroute show as it probes toward a destination?',['The sequence of Layer 3 hops that respond','The switch MAC table on the PC','The DNS zone file','The Wi-Fi password'],'The sequence of Layer 3 hops that respond','Traceroute varies the packet TTL/hop limit to reveal intermediate routers that return responses. Some hops may not answer.'],
  ['Diagnosing Problems','On Windows, which command displays detailed local IP, gateway, and DNS configuration?',['ipconfig /all','show ip route','nslookup /all','tracert /config'],'ipconfig /all','ipconfig /all lists detailed configuration for Windows network adapters.'],
  ['Diagnosing Problems','Which command displays the local routing table on Windows?',['route print','ping','hostname','net use'],'route print','route print shows the routes installed on the local Windows host.'],
  ['Diagnosing Problems','On a Cisco switch, which command gives a brief list of interface IP addresses and status?',['show ip interface brief','show cdp neighbors','show startup-config','show vlan password'],'show ip interface brief','This command summarizes interface addresses and their line/protocol status.'],
  ['Security','Which part of the CIA triad protects information from unauthorized modification?',['Availability','Confidentiality','Integrity','Accounting'],'Integrity','Integrity concerns the correctness and protection of data against unauthorized changes.'],
  ['Security','In AAA, which function records resource use and user activity?',['Authentication','Authorization','Accounting','Encryption'],'Accounting','Accounting logs activity and resource use; authentication checks identity and authorization decides access.'],
  ['Security','Which Wi-Fi security deployment typically uses individual usernames and a RADIUS/802.1X server rather than one shared home passphrase?',['WPA2-Personal','WPA2-Enterprise','Open Wi-Fi','WEP only'],'WPA2-Enterprise','Enterprise mode uses 802.1X/EAP with an authentication server; Personal mode commonly uses a shared pre-shared key.'],
  ['Security','Which security principle is most directly supported by encrypting a sensitive email so unauthorized people cannot read it?',['Confidentiality','Availability','Routing','Address translation'],'Confidentiality','Encryption helps keep information secret from people who are not authorized to read it.']
];

const questions = [], explanations = {}, seen = new Map();
for (const [section, cards] of sections) for (const card of cards) {
  const [page, sourceQuestion, rawOptions, key, sourceExplanation, sourceNote, pictures] = card;
  if (dropPages.has(page)) continue;
  const patch = replacements[page] || {};
  let question = patch.question || sourceQuestion.replace(/\s+/g, ' ').trim();
  let options = (patch.options || rawOptions.map(([, text]) => text)).map(text => text.trim());
  let correctAnswers = patch.correct ? patch.correct.map(index => options[index]) : [...key].map(letter => {
    const found = rawOptions.find(([label]) => label === letter);
    if (!found) throw new Error(`Answer key ${key} on slide ${page} does not map to an option.`);
    return found[1].trim();
  });
  if (page === 36) {
    question = 'What packets does OSPF use to discover neighbors and form adjacencies?';
    options = ['Hello packets carried directly over IP', 'TCP SYN packets on port 179', 'ARP requests', 'DHCP Discover messages'];
    correctAnswers = [options[0]];
  }
  if (page === 45) question = replacements[45].question;
  if (page === 61) question = replacements[61].question;
  if (page === 68) question = replacements[68].question;
  if (page === 75) question = replacements[75].question;
  if (page === 87) question = replacements[87].question;
  if (page === 88) question = replacements[88].question;
  if (page === 89) question = replacements[89].question;
  if (page === 90) question = replacements[90].question;
  if (page === 91) question = replacements[91].question;
  if (page === 92) question = replacements[92].question;
  if (page === 95) question = replacements[95].question;

  const signature = question.toLowerCase().replace(/[^a-z0-9]/g, '');
  const answerSignature = correctAnswers.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, '')).sort().join('|');
  if (seen.has(signature) && seen.get(signature) === answerSignature) continue;
  seen.set(signature, answerSignature);
  const id = questions.length + 1;
  let questionHtml = `<p>${escapeHTML(question).replace(/\n/g, '<br>')}</p>`;
  if (pictures?.length) {
    const filename = `ccst_notebook_${page}.jpg`;
    const imageData = pictures[0];
    if (!imageData.startsWith('data:image/jpeg;base64,')) throw new Error(`Unexpected exhibit encoding on slide ${page}.`);
    fs.writeFileSync(path.join(exhibitDir, filename), Buffer.from(imageData.split(',')[1], 'base64'));
    questionHtml += `<p><img src="exhibits/${filename}" alt="Reviewer exhibit for slide ${page}"></p>`;
  }
  questions.push({
    id, sourceFile: `Certification · ${section}`, sourcePage: page,
    type: 'multiple_choice_question', question, questionHtml, options, correctAnswers
  });
  let explanation = patch.explanation || sourceExplanation || '';
  if (page === 36) explanation = 'OSPF uses Hello packets to discover and maintain neighbor relationships. OSPF is carried directly over IP protocol 89, not TCP or UDP.';
  if (page === 23) explanation = 'Latency is the delay before data arrives; it does not change the link’s rated bandwidth. High latency can reduce measured throughput for some applications.';
  if (page === 45) explanation = 'A firewall can filter or block traffic by rule. A firewall may also forward web traffic when a destination-NAT/port-forwarding rule is configured, but it does not stop an application from launching on a PC.';
  if (page === 61) explanation = pageNotes[61];
  if (page === 75) explanation = 'PC-A must use an unused address in 172.100.0.0/16, avoid the router at .1 and server at .254, use mask 255.255.0.0, and set the router’s LAN address 172.100.0.1 as its gateway.';
  if (page === 81) explanation = pageNotes[81];
  if (page === 85) explanation = pageNotes[85];
  if (page === 87) explanation = pageNotes[87];
  if (page === 88) explanation = pageNotes[88];
  if (page === 89) explanation = pageNotes[89];
  if (page === 90) explanation = pageNotes[90];
  if (page === 91) explanation = pageNotes[91];
  if (page === 92) explanation = 'nslookup asks DNS for records associated with a host name; the default query returns address records.';
  if (page === 95) explanation = pageNotes[95];
  const correction = pageNotes[page] || sourceNote;
  if (correction && !explanation.includes(correction)) explanation = `${explanation}${explanation ? ' ' : ''}${correction}`;
  explanations[String(id)] = explanation.trim();
}
function escapeHTML(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
for (const [category, question, options, answer, explanation] of supplemental) {
  const id = questions.length + 1;
  questions.push({ id, sourceFile: `Certification · ${category}`, sourcePage: null, type: 'multiple_choice_question', question, questionHtml: `<p>${escapeHTML(question)}</p>`, options, correctAnswers: [answer] });
  explanations[String(id)] = explanation;
}
if (questions.length !== 99) throw new Error(`Expected 99 distinct questions; built ${questions.length}.`);
const metadata = { title: 'CCST Networking Certification Review', sourceFiles: ['CCST_Networking_Reviewer_Notebook_Detailed-2.html', 'Cisco CCST Networking (100-150) topic-aligned supplemental review'], sourceSlideCount: 99, questionCount: questions.length, sourceQuestionCount: questions.length - supplemental.length, supplementalQuestionCount: supplemental.length, questions };
fs.writeFileSync(path.join(SITE, 'ccst-questions.json'), JSON.stringify(metadata, null, 2) + '\n');
fs.writeFileSync(path.join(SITE, 'ccst-explanations.json'), JSON.stringify(explanations, null, 2) + '\n');
console.log(`Built ${questions.length} CCST cards (${metadata.sourceQuestionCount} reviewed source questions + ${supplemental.length} topic-aligned questions).`);
