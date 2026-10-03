# CCST midterm reviewer audit

The separate **CCST midterm** deck was built from `CCST Networking Reviewer 1.pdf` (99 slides). It contains 90 cards. Exact repeat slides were combined, drag-and-drop prompts were converted into playable multiple-choice cards, and the included diagrams were cropped so highlighted answers never appear in the question image.

## Corrections to the supplied answer key

| PDF page | Issue in the reviewer | Used in the quiz |
| --- | --- | --- |
| 5 | The highlighted `/20` is wrong for `255.255.252.0`, and every choice changed the given address from `172.16.199.25` to `172.16.100.25`. | `172.16.199.25/22`. |
| 26 | TFTP is highlighted for IPv6 stateless address configuration. | ICMPv6 Router Advertisements. [Cisco reference](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipv6_basic/configuration/15-s/ip6b-15-s-book/ip6-icmp.html). |
| 35 | The highlighted “Llo” choice is not the protocol used by OSPF; none of the original choices is valid. | Reworded with a valid choice: OSPF packets directly over IP, protocol 89. [Cisco reference](https://www.cisco.com/c/en/us/support/docs/ip/open-shortest-path-first-ospf/47866-ospfdb7.pdf). |
| 39 | SNMP is highlighted, but the question asks to view each switch's running configuration from a command line. | SSH remote CLI, then `show running-config`. [Cisco reference](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3850/software/release/37e/consolidated_guide/b_37e_consolidated_3850_cg/configuring_secure_shell__ssh_.html). |
| 78 | The key marks A and D. With Router1 offline, the pictured VLANs cannot communicate across VLANs. | A and C: no PC reaches File-Srv in VLAN 16, while PC-A and PC-B still communicate inside VLAN 100. [Cisco reference](https://www.cisco.com/c/en/us/support/docs/lan-switching/inter-vlan-routing/14976-50.html). |

Page 10's IPv6 choices were normalized so the valid shortest notation is readable without spacing artifacts. Page 22's incomplete throughput statement was replaced with an answerable concept question. Page 74's unkeyed configuration exhibit was converted into a self-contained question. The unkeyed diagnostics prompts on pages 88–91 and 94 were given explicit choices and explanations.

The page 60 PoE question was excluded because its referenced switch image is absent from the PDF. Pages 87 and similar ambiguous prompts without enough evidence were also excluded. The repeated slides were not added again (for example, pages 9/11, 29/30/73, 31/76, and 81/92).

The source PDF remains in the local `Module` folder. `build_ccst_deck.py` reads it and writes `ccst-questions.json`, `ccst-explanations.json`, and the cropped exhibits used by the website.
