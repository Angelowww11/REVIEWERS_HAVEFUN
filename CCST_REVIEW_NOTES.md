# CCST certification reviewer audit

The separate **CCST certification** deck contains 99 questions: 83 distinct, reviewed cards from `CCST_Networking_Reviewer_Notebook_Detailed-2.html` and 16 additional practice cards aligned to the Cisco CCST Networking exam topics. Seven repeated source slides/cards were omitted. Matching, configuration, and exhibit questions are presented in suitable formats; referenced notebook exhibits are included in `exhibits/`.

The two original true/false exercises (notebook slides 23 and 87; PDF pages 22 and 86) contain three statements each. All six statements and their source-keyed answers are included as individual True/False questions. Slide 28 repeats the MAC-header/FCS question already present on slide 16, so it is correctly deduplicated.

## Corrections and review notes

| Source slide | Correction or clarification |
| --- | --- |
| 5 and 8 | `255.255.252.0` is `/22`. Slide 5’s answer options contain a host-address typo, so the corrected item keeps the stated `172.16.199.25` and selects `/22`. |
| 27 | SLAAC uses ICMPv6 Router Solicitation/Advertisement messages. The source key incorrectly marks TFTP. |
| 36 | OSPF discovers neighbors with Hello packets and uses IP protocol 89 directly. The source choices contain a broken answer label, so the item was repaired. |
| 45 | A network firewall can block traffic by port; endpoint controls govern whether an application may run. Destination NAT can forward traffic when configured. |
| 50 | The source misspells “inherence”; biometric traits are the inherence factor. A one-time code sent to a phone is possession. |
| 52 | The source notes its labels are swapped. Disable WPS to disable push-button setup; disabling SSID broadcast only hides the network name. |
| 60/61 | The source’s referenced port diagram is missing. The item is rewritten to ask which Ethernet feature can carry both power and data (PoE). |
| 72, 84 | A traceroute can reach its destination even if intermediate hops do not reply. |
| 79 | The exhibit shows that PC-A and PC-B can communicate in their shared VLAN when Router1 is down; traffic between VLANs cannot route. Correct choices are A and C, not A and D. |
| 80–81 | The unknown-unicast and broadcast forwarding answers follow switch flooding rules, excluding the ingress port. |
| 85 | A `router1#` prompt is privileged EXEC mode, not user EXEC mode. |
| 86–95 | Switch MAC-table, interface-state, configuration, DNS, traceroute, and CDP items were keyed from their displayed output and clarified where their original prompt was incomplete. |

Answer keys were checked against the exhibits and Cisco networking behavior, then cross-checked against the [Cisco CCST Networking exam topics](https://learningnetwork.cisco.com/s/ccst-networking-exam-topics). Supplemental questions follow that published outline; they do not change the source notebook items. The exam outline is a coverage guide, not a substitute for hands-on lab practice.

The build script `build_ccst_notebook.mjs` reads the original notebook and regenerates the deck, explanation text, and included exhibits. The notebook is a local source file and is not required to run the site.
