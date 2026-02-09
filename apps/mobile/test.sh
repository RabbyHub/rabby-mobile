
# https://alpha.rabby.io/v1/notification/device/push_logs?user_addr=0x341a1fbd51825e5a107db54ccb3166deba145479&device_id=edbdcc4d-ee2f-43b8-aebe-3389b37470f0-ios-BB34DBCC-C4B2-4739-A59D-F1F7EF6D578A

# # debug, swap
# curl --location 'https://alpha.rabby.io/v1/notification/device/test_push' \
# --header 'Content-Type: application/json' \
# --data '{
#  "tx_id": "0x940a2d56cd423839a0eaff70823160c25ec8687a8a660c57ff093469157635ec",
#  "device_id": "edbdcc4d-ee2f-43b8-aebe-3389b37470f0-ios-BB34DBCC-C4B2-4739-A59D-F1F7EF6D578A"
# }'

# # debug, approve
# curl --location 'https://alpha.rabby.io/v1/notification/device/test_push' \
# --header 'Content-Type: application/json' \
# --data '{
#  "tx_id": "0x4fdc2e10eecb407a7393bdd3e2de5bf98fb938ea0fabcc215f45c5656dc9168e",
#  "device_id": "edbdcc4d-ee2f-43b8-aebe-3389b37470f0-ios-BB34DBCC-C4B2-4739-A59D-F1F7EF6D578A"
# }'

# # debug, send
# curl --location 'https://alpha.rabby.io/v1/notification/device/test_push' \
# --header 'Content-Type: application/json' \
# --data '{
#  "tx_id": "0x4c28f44da1027943dc99afe9423ce6b41efba1e1e9238e2d56d27a0830d5fb7d",
#  "device_id": "edbdcc4d-ee2f-43b8-aebe-3389b37470f0-ios-BB34DBCC-C4B2-4739-A59D-F1F7EF6D578A"
# }'

# # debug, send
# curl --location 'https://alpha.rabby.io/v1/notification/device/test_push' \
# --header 'Content-Type: application/json' \
# --data '{
#  "tx_id": "0x801af045718322f1c6246864b28769c1edd4abb5e6262b236c166060c0f9473e",
#  "device_id": "6927991d-3764-4cec-b924-9939031cafa5-ios-BB34DBCC-C4B2-4739-A59D-F1F7EF6D578A"
# }'

# debug, received
curl --location 'https://alpha.rabby.io/v1/notification/device/test_push' \
--header 'Content-Type: application/json' \
--data '{
 "tx_id": "0xc1d6bd60e09476af52c0eae3fd65f770d26ee6641c086771685dbe37cf2879cb",
 "device_id": "6927991d-3764-4cec-b924-9939031cafa5-ios-BB34DBCC-C4B2-4739-A59D-F1F7EF6D578A"
}'
