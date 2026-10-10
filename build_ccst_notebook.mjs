import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE = __dirname;
const SOURCE = path.resolve(SITE, '../../CCST_Networking_Reviewer_Notebook_Detailed-2.html');
const exhibitDir = path.join(SITE, 'exhibits');
let raw = fs.readFileSync(SOURCE, 'utf8');
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
const dropPages = new Set([11, 25, 31, 77, 94, 99]);
const dragPages = new Set([18, 19, 20, 21, 24, 49, 50, 51, 52, 68, 75]);
const trueFalseStatements = {
  23: [
    ['High levels of network latency decrease network bandwidth.', 'False', 'Latency is delay; it does not change a link’s rated bandwidth capacity. It can affect achieved throughput, especially during round trips.'],
    ['Low bandwidth can increase network latency.', 'True', 'A low-capacity link can add transmission and queuing delay under load. Bandwidth and latency are different measures, but limited capacity can contribute to longer delays.'],
    ['You can increase throughput by decreasing network latency.', 'True', 'Reducing latency can improve achieved throughput, especially for traffic that needs acknowledgements. Throughput also depends on bandwidth, loss, congestion, and endpoints.']
  ],
  87: [
    ['A device connected to GigabitEthernet0/1 can send out broadcast traffic.', 'False', 'The exhibit shows GigabitEthernet0/1 as down/down, so it cannot forward frames.'],
    ['A technician issued the shutdown command on interface GigabitEthernet0/2.', 'True', 'The interface status is administratively down, indicating it was disabled in configuration.'],
    ['A technician set the IP address for GigabitEthernet0/0 by using the CLI.', 'True', 'The Method column shows manual for GigabitEthernet0/0, indicating a manually configured address.']
  ]
};
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
  88: { question: 'A new switch’s running configuration lists interface GigabitEthernet0/1 and 0/2 with no other settings. What can you conclude from the shown lines?', options: ['Both ports were shut down.', 'Both ports have manually assigned IP addresses.', 'The shown configuration does not indicate shutdown or assigned IP addresses.', 'The switch has no Layer 2 ports.'], correct: [2] },
  89: { question: 'The PC’s DNS server is 64.100.8.8. Which command shows the router hops on the path to that DNS server?', options: ['ipconfig /all', 'ping 64.100.8.8', 'tracert 64.100.8.8', 'nslookup 64.100.8.8'], correct: [2] },
  90: { question: 'A web application uses https://www.companypro.net:7100/api. Which Wireshark display filter selects TCP packets using that port?', options: ['tcp.port == 7100', 'dns.port == 7100', 'ip.addr == 7100', 'http.host == 7100'], correct: [0] },
  91: { question: 'A PC has IPv4 address 192.168.0.14/24 and default gateway 192.168.0.1. Which command checks whether the gateway responds?', options: ['ping 192.168.0.1', 'nslookup 192.168.0.1', 'tracert 8.8.8.8', 'ipconfig /renew'], correct: [0] },
  92: { question: 'Which command queries DNS for the IPv4 addresses associated with www.companypro.net?', options: ['ipconfig www.companypro.net', 'nslookup www.companypro.net', 'ping /dns www.companypro.net', 'tracert www.companypro.net'], correct: [1] },
  95: { question: 'Which Cisco IOS command displays the neighbor table shown in the exhibit?', options: ['show ip route', 'show mac address-table', 'show cdp neighbors', 'show interfaces status'], correct: [2] }
,
  18: { dragPairs: [['SFTP','SSH key file transfer, port 22'],['TFTP','UDP transfers on port 69'],['DNS','Resolves domain names to IP addresses'],['DHCP','Reserves a server IP address'],['ICMP','Ping requests and replies']] },
  19: { dragPairs: [['Application','SMTP and FTP'],['Transport','TCP and UDP'],['Physical','Cable, hub, and NIC'],['Data Link','Switch'],['Network','Router']] },
  20: { dragPairs: [['TCP','Transport'],['IP','Internet'],['FTP','Application'],['Ethernet','Network Access']] },
  21: { dragPairs: [['PAN','Personal devices within about 10 meters'],['LAN','Room or office network'],['WAN','Long-distance network']] },
  24: { dragPairs: [['PaaS','Application development platform'],['IaaS','Virtual machines and storage'],['SaaS','Web-based software']] },
  49: { dragPairs: [['Integrity','Digital signature detects changes'],['Confidentiality','Encrypt an email'],['Availability','Redundant web servers']] },
  50: { dragPairs: [['Knowledge','Username and password'],['Possession','One-time device code'],['Inherence','Face recognition']] },
  51: { dragPairs: [['WEP','40-bit encryption'],['WPA-Enterprise','RADIUS authentication'],['WPA2-Personal','AES and pre-shared key']] },
  52: { dragPairs: [['Disable WPS','Stop push-button access'],['Set WPA2-PSK','Use a pre-shared key'],['Disable SSID broadcast','Hide Wi-Fi name']] },
  68: { dragPairs: [['Switch to R1 Gi0/0/1','Straight-through UTP'],['R2 to R3 underground conduit','Fiber-optic cable'],['R1 Gi0/0/0 to R2 Gi0/0/1','Crossover UTP'],['Switch S3 to Server0 NIC','Straight-through UTP']] },
  75: { dragPairs: [['IP address','Unused host in 172.100.0.0/16, e.g. 172.100.0.10'],['Subnet mask','255.255.0.0'],['Default gateway','172.100.0.1']] }
};

const questions = [], explanations = {}, seen = new Map();
for (const [section, cards] of sections) for (const card of cards) {
  const [page, sourceQuestion, rawOptions, key, sourceExplanation, sourceNote, pictures] = card;
  if (dropPages.has(page)) continue;
  const trueFalse = trueFalseStatements[page];
  if (trueFalse) {
    let imageMarkup = '';
    if (pictures?.length) {
      const filename = `ccst_notebook_${page}.jpg`, imageData = pictures[0];
      if (!imageData.startsWith('data:image/jpeg;base64,')) throw new Error(`Unexpected exhibit encoding on slide ${page}.`);
      fs.writeFileSync(path.join(exhibitDir, filename), Buffer.from(imageData.split(',')[1], 'base64'));
      imageMarkup = `<p><img src="exhibits/${filename}" alt="Reviewer exhibit for slide ${page}"></p>`;
    }
    const question = 'For each statement, choose True or False.';
    const id = questions.length + 1;
    questions.push({ id, sourceFile: `Certification · ${section}`, sourcePage: page, type: 'true_false_group', question, questionHtml: `${imageMarkup}<p>${escapeHTML(question)}</p>`, statements: trueFalse.map(([text]) => text), options: ['True', 'False'], correctAnswers: trueFalse.map(([, answer]) => answer) });
    explanations[String(id)] = trueFalse.map(([text, answer, explanation], index) => `${index + 1}. ${answer} — ${explanation}`).join('\n');
    questions[questions.length - 1].statementExplanations = trueFalse.map(([, , explanation]) => explanation);
    continue;
  }
  const patch = replacements[page] || {};
  let question = patch.question || sourceQuestion.replace(/\s+/g, ' ').trim();
  let options = (patch.options || rawOptions.map(([, text]) => text)).map(text => text.trim());
  const dragPairs = dragPages.has(page) ? (patch.dragPairs || key.split('·').map(pair => pair.split('→').map(value => value.trim())).filter(pair => pair.length === 2)) : null;
  if (dragPages.has(page)) { if (!dragPairs || dragPairs.length < 2) throw new Error(`Slide ${page} has no answer pairs.`); question += ' Match each item to its correct description.'; }
  let correctAnswers = patch.correct ? patch.correct.map(index => options[index]) : [...key].map(letter => rawOptions.find(([label]) => label === letter)?.[1]?.trim()).filter(Boolean);
  if (!correctAnswers.length && !dragPairs) throw new Error(`Question on slide ${page} has no usable key.`);
  if (page === 36) { question = 'What packets does OSPF use to discover neighbors and form adjacencies?'; options = ['Hello packets carried directly over IP', 'TCP SYN packets on port 179', 'ARP requests', 'DHCP Discover messages']; correctAnswers = [options[0]]; }
  const answers = dragPairs ? dragPairs.map(pair => `${pair[0]} → ${pair[1]}`) : correctAnswers;
  const signature = question.toLowerCase().replace(/[^a-z0-9]/g, '');
  const answerSignature = answers.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, '')).sort().join('|');
  if (seen.has(signature) && seen.get(signature) === answerSignature) continue;
  seen.set(signature, answerSignature);
  const id = questions.length + 1;
  let questionHtml = `<p>${escapeHTML(question)}</p>`;
  if (pictures?.length) { const filename = `ccst_notebook_${page}.jpg`; const imageData = pictures[0]; if (!imageData.startsWith('data:image/jpeg;base64,')) throw new Error(`Unexpected exhibit encoding on slide ${page}.`); fs.writeFileSync(path.join(exhibitDir, filename), Buffer.from(imageData.split(',')[1], 'base64')); questionHtml += `<p><img src="exhibits/${filename}" alt="Reviewer exhibit for slide ${page}"></p>`; }
  questions.push({ id, sourceFile: `Certification · ${section}`, sourcePage: page, type: dragPairs ? 'matching_question' : 'multiple_choice_question', question, questionHtml, options: dragPairs ? dragPairs.map(pair => pair[0]) : options, correctAnswers: answers, ...(dragPairs ? { dragPairs: dragPairs.map(pair => ({ item: pair[0], target: pair[1] })) } : {}) });
  let explanation = patch.explanation || sourceExplanation || '';
  if (pageNotes[page] && !explanation.includes(pageNotes[page])) explanation += `${explanation ? ' ' : ''}${pageNotes[page]}`;
  if (page === 36) explanation = pageNotes[36];
  explanations[String(id)] = explanation.trim();
}
function escapeHTML(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
const supplemental = [
  ['Standards & Concepts','What does network throughput measure?',['The maximum theoretical capacity of a link','The amount of data successfully transferred over time','The physical cable length','The number of addresses in a subnet'],'The amount of data successfully transferred over time','Bandwidth describes capacity; throughput is the achieved data-transfer rate.'],
  ['Standards & Concepts','Which DNS record type maps a host name to an IPv6 address?',['A','AAAA','MX','CNAME'],'AAAA','An AAAA record stores an IPv6 address; an A record stores IPv4.'],
  ['Standards & Concepts','In DHCP’s DORA exchange, what does a client send first when requesting a lease?',['Discover','Offer','Request','Acknowledge'],'Discover','The client broadcasts Discover; a server may then Offer, the client Requests, and the server Acknowledges.'],
  ['Addressing','Which address is a public IPv4 address?',['10.20.30.40','172.20.5.6','192.168.10.5','8.8.8.8'],'8.8.8.8','The other choices are inside RFC 1918 private ranges. 8.8.8.8 is a publicly routable address.'],
  ['Addressing','A Windows PC self-assigns an address in 169.254.0.0/16. What is the most likely explanation?',['It did not receive a DHCP lease','It is using the IPv6 loopback','It has a public address','The DNS server assigned it'],'It did not receive a DHCP lease','Windows uses an IPv4 link-local/APIPA address when it cannot obtain a DHCP lease.'],
  ['Addressing','What does the IPv6 address ::1 represent?',['The default route','The loopback address','A link-local gateway','A multicast group'],'The loopback address','::1 is the IPv6 loopback address, equivalent in purpose to IPv4 127.0.0.1.'],
  ['Endpoints & Media','Which connector is commonly used with fiber-optic links in local-area network equipment?',['RJ-11','LC fiber connector','BNC coaxial connector','USB-A'],'LC fiber connector','LC is a small form-factor fiber connector commonly used with optical transceivers.'],
  ['Endpoints & Media','Compared with 5 GHz Wi-Fi, 2.4 GHz Wi-Fi generally offers which tradeoff?',['Shorter range and less interference','Longer range but often more interference','No radio interference','Wired-level latency'],'Longer range but often more interference','2.4 GHz often reaches farther and penetrates walls better, but it has fewer channels and more sources of interference.'],
  ['Infrastructure','How does a Layer 2 switch learn which port leads to a device?',['It records the source MAC address of an arriving frame','It reads the destination IP address in DNS','It sends every frame to the router first','It learns only from DHCP offers'],'It records the source MAC address of an arriving frame','The switch associates a frame’s source MAC address and VLAN with the ingress port in its MAC table.'],
  ['Infrastructure','What does a router primarily use to choose where to forward an IP packet?',['The destination IP address and its routing table','The source application name only','The Ethernet cable color','A DNS MX record'],'The destination IP address and its routing table','A router compares the destination IP to routes and forwards toward the best matching route.'],
  ['Infrastructure','What does full-duplex Ethernet allow a device to do?',['Send and receive at the same time','Send only after receiving a frame','Use two IP addresses on one port','Forward broadcasts between VLANs'],'Send and receive at the same time','Full duplex supports simultaneous transmission and reception on a link.'],
  ['Addressing','Which IPv4 range is reserved for private networks?',['10.0.0.0/8','11.0.0.0/8','100.0.0.0/8','200.0.0.0/8'],'10.0.0.0/8','The RFC 1918 private IPv4 blocks are 10/8, 172.16/12, and 192.168/16.'],
  ['Diagnosing Problems','What does tracert/traceroute show as it probes toward a destination?',['The sequence of Layer 3 hops that respond','The switch MAC table on the PC','The DNS zone file','The Wi-Fi password'],'The sequence of Layer 3 hops that respond','Traceroute varies the packet TTL/hop limit to reveal intermediate routers that return responses. Some hops may not answer.'],
  ['Diagnosing Problems','On Windows, which command displays detailed local IP, gateway, and DNS configuration?',['ipconfig /all','show ip route','nslookup /all','tracert /config'],'ipconfig /all','ipconfig /all lists detailed configuration for Windows network adapters.'],
  ['Diagnosing Problems','Which command displays the local routing table on Windows?',['route print','ping','hostname','net use'],'route print','route print shows the routes installed on the local Windows host.'],
  ['Diagnosing Problems','On a Cisco switch, which command gives a brief list of interface IP addresses and status?',['show ip interface brief','show cdp neighbors','show startup-config','show vlan password'],'show ip interface brief','This command summarizes interface addresses and their line/protocol status.'],
  ['Diagnosing Problems','What is the purpose of a DHCP relay agent?',['Forward client DHCP messages across subnets','Translate private addresses to public addresses','Encrypt DNS lookups','Assign MAC addresses to switch ports'],'Forward client DHCP messages across subnets','A relay forwards DHCP broadcasts between a client subnet and a remote DHCP server.'],
  ['Security','In AAA, which function records resource use and user activity?',['Authentication','Authorization','Accounting','Encryption'],'Accounting','Accounting logs activity and resource use; authentication checks identity and authorization decides access.'],
  ['Security','Which Wi-Fi security deployment typically uses individual usernames and a RADIUS/802.1X server rather than one shared home passphrase?',['WPA2-Personal','WPA2-Enterprise','Open Wi-Fi','WEP only'],'WPA2-Enterprise','Enterprise mode uses 802.1X/EAP with an authentication server; Personal mode commonly uses a shared pre-shared key.'],
  ['Security','Which security practice most directly reduces the risk of unauthorized account access after a password is stolen?',['Enable multifactor authentication','Hide the computer name','Disable DHCP','Change the Ethernet cable'],'Enable multifactor authentication','A second factor makes a stolen password alone insufficient to authenticate.']
];

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
