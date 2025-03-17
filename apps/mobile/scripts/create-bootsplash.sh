# On M-series chip, run command below on x86_64 context. e.g. arch -x86_64 /bin/bash
./node_modules/.bin/react-native-bootsplash generate ./src/assets/icons/common/logo-blue.svg \
  --project-type=bare \
  --platforms=android,ios \
  --background=F5FCFF \
  --logo-width=100 \
  --assets-output=assets/bootsplash \
  --flavor=main
