# utmlab
最小構成のUTM検証プラットフォーム

#全体像
[UAS Simulator群]───┐
[実機/地上局(SITL)]─┼─> ① UASSP Adapter(API/WS) ──┐
[SDSP Stub/実API]───┘                               │
                                                     v
                    ② FIMS Core(API Gateway/Policy Engine)
                             │  ^               │
      (OIDC/PKI) ④ AuthN/Z ─┘  │   ③ Event Bus│(MQTT/Kafka)
                             │  │               v
                             │  └── ⑤ Latency Probe(Stamp/Trace)
                             │
                             v
        ⑥ Metrics & Store(Prometheus/TimescaleDB/ELK)
                             │
                             v
                ⑦ Dashboard & Test Orchestrator(Grafana/GUI)


#フォルダ構造

utm-lab/
├─ package.json
├─ .env                       # ポート等の設定（なくてもOK）
├─ README.md                  # 手順まとめ
├─ common/
│  └─ schema/
│     ├─ flightplan.schema.json
│     └─ event.schema.json
├─ fims/
│  └─ fims.js                 # FIMS（統合ハブ）
├─ uassp/
│  └─ uassp.js                # UASSP（運航管理、2インスタンス起動可）
├─ simulator/
│  └─ sim.py                  # ドローン挙動シミュレータ（Python）
└─ logs/
   ├─ fims.ndjson
   ├─ uassp_A.ndjson
   └─ uassp_B.ndjson
