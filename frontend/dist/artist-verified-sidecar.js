// P1-E: explicitly reviewed read-only Catalog scopes; no automatic alias/name matching.
export default {
  "version": 1,
  "artists": [
    {
      "id": "ar_00000000-0000-4000-8000-000000000001",
      "name": "015B",
      "kind": "group",
      "revision": 1,
      "verified": true,
      "externalIds": {
        "musicbrainz": "4cebbc8b-6ae8-4288-b183-b6f11bdd749d"
      },
      "externalIdsVerified": true,
      "sources": [
        {
          "label": "MusicBrainz · 공식 페이지 검색 자료(실시간 API 아님)",
          "url": "https://musicbrainz.org/artist/4cebbc8b-6ae8-4288-b183-b6f11bdd749d"
        }
      ],
      "updated": "2026-10-27",
      "country": "대한민국",
      "holdings": {
        "verified": true,
        "albums": 78,
        "asOf": "2026-10-27T08:37:56.559909+00:00",
        "catalogRevision": "1793085366.781885"
      }
    },
    {
      "id": "ar_00000000-0000-4000-8000-000000000002",
      "name": "John Lennon",
      "kind": "person",
      "revision": 1,
      "verified": true,
      "externalIds": {
        "musicbrainz": "4d5447d7-c61c-4120-ba1b-d7f471d385b9"
      },
      "externalIdsVerified": true,
      "sources": [
        {
          "label": "MusicBrainz · 공식 페이지 검색 자료(실시간 API 아님)",
          "url": "https://musicbrainz.org/artist/4d5447d7-c61c-4120-ba1b-d7f471d385b9"
        }
      ],
      "updated": "2026-10-27",
      "summary": "The Beatles의 멤버로 활동한 음악가.",
      "photo": {
        "approved": true,
        "identityVerified": true,
        "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/John_Lennon%2C_1974.jpg/330px-John_Lennon%2C_1974.jpg",
        "cacheFile": "artist-photo-61439037c3472e9ccf33ff0e0a81b6facfe9606cf8478b3bf260fe9f6e21bc83.jpg",
        "sha256": "61439037c3472e9ccf33ff0e0a81b6facfe9606cf8478b3bf260fe9f6e21bc83",
        "source": "https://commons.wikimedia.org/wiki/File:John_Lennon,_1974.jpg",
        "author": "Tony Barnard, Los Angeles Times / UCLA Library",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "changes": "330px 축소본 · 화면에서 정사각형 맞춤 표시",
        "reviewedAt": "2026-10-27"
      },
      "holdings": {
        "verified": true,
        "albums": 105,
        "asOf": "2026-10-27T08:37:56.559909+00:00",
        "catalogRevision": "1793085366.781885"
      }
    },
    {
      "id": "ar_00000000-0000-4000-8000-000000000003",
      "name": "The Beatles",
      "kind": "group",
      "revision": 1,
      "verified": true,
      "externalIds": {
        "musicbrainz": "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d"
      },
      "externalIdsVerified": true,
      "sources": [
        {
          "label": "MusicBrainz · 공식 페이지 검색 자료(실시간 API 아님)",
          "url": "https://musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d"
        }
      ],
      "updated": "2026-10-27",
      "holdings": {
        "verified": true,
        "albums": 343,
        "asOf": "2026-10-27T08:37:56.559909+00:00",
        "catalogRevision": "1793085366.781885"
      }
    }
  ],
  "bindings": [
    {
      "artistId": "ar_00000000-0000-4000-8000-000000000003",
      "catalogName": "The Beatles",
      "scope": "albums",
      "albumIds": [
        "85711b71-33e1-49b5-b00c-50425645d08f",
        "aab724cb-55ed-47b9-a9b6-d363b2c17555",
        "4f28ae8d-f624-484d-91e5-317bc763328a",
        "9880ba4e-1ffc-4e33-8a16-cbdff7a317d1",
        "74d771ee-a964-4de9-b4a9-0d61b9b789e4",
        "3e3a7104-6a6a-4d4c-a29c-14fdc48690dd",
        "9d80dab7-56aa-4bfa-bdba-7faee9c50c2a",
        "1ce67f49-c884-4f07-916f-cb2c982c8b39",
        "8a9c5819-a7a5-4bd4-8a0f-0646fe03d6d2",
        "87e6c4b4-68fd-4c52-8d52-29b7047affd4",
        "529cbd86-41cb-4d50-b20a-2aee7619a776",
        "157540d5-31d7-407b-9ee0-157f0c47c999",
        "f773523c-77f5-4a0c-bd30-cec08c6f2adf",
        "82769758-33aa-4e2a-843c-d0328e6237d0",
        "63bb5ce7-9476-4741-a2fe-6ac825074745",
        "bf56fdce-adf5-432e-b28f-6a4ba108dd0b",
        "0995d423-2e0f-4652-b8ee-61050b3dd905",
        "2262c269-1e50-4a4b-93f2-7f4616bb7409",
        "1bc07a92-9bf6-4d94-b809-c8df6cf730d8",
        "8ee8c235-e133-4ce4-970c-01ce9a2faf52",
        "69a0e6d4-92f0-4028-ac0b-24bec6cd663f",
        "dff3e52b-0e93-4d83-9c67-e9acba9497b5",
        "1a3215bb-4926-45b6-a6ee-e5f9cf2e3368",
        "6d6015dd-2120-4045-85fd-08568971b342",
        "c1ff77a5-9528-4154-bfb4-ae4bfa866210",
        "84d3fd4d-4c25-4c98-b8ea-9d9ff86dfd2a",
        "6d4e0197-2139-42fc-9a17-d9b1d09cdfa9",
        "e6762b4c-d153-405b-986a-6d2779591831",
        "e46336df-bf04-4216-b21a-640e1e8f7406",
        "315e0dea-4818-4c44-aac5-4da1f8979a7a",
        "678061eb-3afd-46ba-a455-ffc4113d57d4",
        "3e994dc2-687a-4634-8c76-d2a3ad67223a",
        "cea9a9b7-c3e5-4f4b-9f70-1e81a9fad7c4",
        "61ee5d55-f21f-4a3e-a5b9-277e260769d2",
        "b670696e-3f7a-49e6-98d4-74c15ee24afc",
        "503d36cc-8443-42aa-bc3a-6d876bf55ee2",
        "fd3e0945-6e92-48a2-8b9a-edf997b90d7a",
        "cdfee396-1edd-4e43-8f9b-09534f2910a3",
        "1f3c59aa-eb57-412a-bc52-51552b5b9b41",
        "8e665ff1-c814-428b-8d2b-19ec88a25bfe",
        "c4b39f57-924a-45fb-af12-15b4930063f5",
        "2c8f00a3-fa38-4f97-a310-bf359dae2537",
        "a9e0f549-b5de-42c2-bc7a-44a4d29bc4b9",
        "19f1be24-2ef1-490b-916d-6abf528146dc",
        "5d2bdd9e-ddd7-49d5-b039-f08929fcf44f",
        "0fa7a5a4-3bb1-4795-945a-d8c08b777c23",
        "ccd0c481-f645-4365-93cf-d8a83d67b688",
        "37b7adf3-4b24-42c6-92e4-83d0d1bdde15",
        "5fe02d8f-53c6-4768-85fe-680edea9b040",
        "497990d1-2ad5-4a98-9194-92953bf1492f",
        "4b29f8de-6d2f-458f-a43d-f34eacb062a8",
        "2f5342db-1123-4c38-88aa-3d1c0d508db5",
        "c61aad4d-0d31-4fdd-ada0-e1a7b99e6283",
        "7ac29294-75ac-434d-8c73-95340d5c78de",
        "09906857-7980-45d9-b6b8-be5c053bd2d9",
        "d0256347-a5b8-447d-b5c1-9ed5864cffa2",
        "beee8da2-4145-4b88-b264-18b6c19bc137",
        "b1e3bd3d-864e-4aea-9990-b257d5f14cb9",
        "65d7b365-d427-45a8-930d-835ba2f10c3a",
        "bbf22d14-f478-47cd-a527-ddb3bffeaf7d",
        "dfc04ff3-60f8-416d-8a2c-16e9e04305cf",
        "ac59da40-5d4b-4336-8309-7a233ea8080c",
        "e5a0788d-187d-49b2-b6de-8fb497d534ab",
        "443b96c2-ab6b-4070-b38f-feeae239852f",
        "ebb16139-1aee-4ef2-a35d-57c7a1cfc2dc",
        "1fcbf642-3888-4c68-bb05-eae0c93b1002",
        "90e59ade-3ae8-4ba6-a05d-f52a0d5a011e",
        "4ca5ec37-bf35-4995-81fa-b488cb613e11",
        "ce03de40-8eba-4a0e-ab98-d702353ecd60",
        "fe473fc1-90b8-4362-b5a3-259feb97437c",
        "5859b4fe-cb27-4cbe-9dc3-a456bfa09664",
        "acd8ca69-6eba-4eb3-a8c5-40e6d43c9ed8",
        "6cc0591d-4152-44e9-be2d-ba694b1661bd",
        "f4ee5544-76fa-49d5-aa76-4ccaa8ec65b7",
        "6288eebc-f024-444c-9df1-cb4c947fe65d",
        "b816a045-50a9-4514-ad05-365e8f994f04",
        "3e5d04df-16ca-4b1b-9d7d-554463b5f535",
        "11cd5321-dbba-4dbb-a5cc-769a8f6c3906",
        "4886b7db-3a2b-4e0e-8241-d95493728748",
        "49d5c72f-915a-44f9-83f9-09368893d458",
        "31ee7c2c-75ec-4ba7-88c2-aabfe0f7571c",
        "d8a8f8cb-5455-491f-85b8-2d5e894bd130",
        "4092cd0a-0df3-472a-89dc-5b4b40ad0070",
        "518996fb-cc95-4999-95a4-02f8604f5011",
        "7580337e-8d69-40b1-b38c-7854efdfcd59",
        "382f688f-ce48-4987-bfb7-6bb3fe702812",
        "e29e00fe-1022-41c1-b6b0-149a8a3e830c",
        "d51cc5f6-1811-4232-a309-9477df234766",
        "46695b65-0dc2-4711-b6f5-872a3aea4de5",
        "f5daba8a-38cd-4103-b250-1f51dcb960d3",
        "49ec1d0e-06ba-4468-8998-7a5098d43130",
        "d6d7caba-821d-4f1f-a78d-ebaaad3a2fb1",
        "6ca8935f-2226-413d-b28b-76ebbb597462",
        "e10e8f99-4f12-419b-b41a-ebfe03bb4532",
        "2553e60f-aa2e-44aa-aa15-74eeb9a3d5c7",
        "b7d0ce2c-38de-4dfa-b7de-981570d94a6a",
        "3f131935-d599-4da5-a65b-f11d5da3c85c",
        "2c21db67-024e-4358-a327-f4b2778f1a81",
        "7a56a486-d0af-4ae9-bd4b-80b0b5a2b601",
        "f1d66c91-0509-4f45-93f2-59b70915f820",
        "101715e8-430b-4ca4-a247-4fe545f1fd59",
        "55c04da6-7f0b-4db3-9036-e08beac9c655",
        "a24561cd-784c-43be-857b-848be6424402",
        "fdaff572-f65e-4062-ae30-bf219887e7fa",
        "c311cbfc-6ea2-496b-b75c-aabd54e2916f",
        "73d17d0b-de2c-4911-8dce-0c9cabcbebe2",
        "0b51f697-8fad-4433-8bb6-8324154ef198",
        "cd0d9416-a783-4853-9b8c-8765189a8c03",
        "ad48ba3a-e8af-41c8-9759-ebfe8fea1379",
        "38db5158-15c7-4059-a97a-4746b4dd1c5c",
        "67d92d7e-4133-4a1f-bbfb-440cec2744ba",
        "45867549-8b9d-4aa1-8429-a5caa762860f",
        "526ba56c-c5d0-4a3b-8bf3-6bb601d4c36d",
        "df35f85c-2f45-4742-bd17-92c60aac2345",
        "f1200de4-0a78-4920-bde6-60a418d775b5",
        "ea2ce42c-60c4-4e57-b4b7-486c26dca6a8",
        "2618c131-69e7-4cde-aac3-ccc41537a8c5",
        "5844e0af-475c-4633-ba28-a5cfb9b5c9c5",
        "6661cbcd-95b3-458f-be11-8c4137759646",
        "c1f6cc70-2a5b-4c5a-bc11-954d27c4f877",
        "d4646d53-dbd3-4020-9aa1-aa2a2c1c07c5",
        "2b649ff0-91c8-474c-bd7a-d1b25e4071d9",
        "3847cab8-3d0a-47c6-ac32-57333479483b",
        "f5b3f586-2efb-4bb3-a078-6c816813bc9b",
        "cfed6d0a-e9c4-4349-8b38-9d9a44710a67",
        "50e7b4c0-ffe2-4dc0-a73c-57d52e37ceee",
        "94b5db8e-05a0-46d7-8560-3277eece88ee",
        "dfd78a6a-2f88-49f3-9a71-6a0b2493e67a",
        "105b8e0f-d58b-421b-a49f-b044934141e8",
        "61f17c44-b796-451d-9f6b-278f2f83fc60",
        "d81dcb96-8277-47a3-8c4a-67f001a93847",
        "17f638a9-794a-4231-ab18-0e2eceaa97ad",
        "9d7fbcca-1c6b-4d7a-954f-212308494c16",
        "f06e101b-0913-4427-a7ad-aa964a9406d8",
        "74f2cbc1-07bd-4659-a981-461553be039c",
        "ac614867-fdd0-480e-9bca-61de79179df5",
        "f2a518f5-f8bc-438e-b634-74be59f50b9a",
        "f89d0919-225e-4618-aac3-7c6df10e6fd5",
        "e7c9d886-b08c-4bb0-a0c3-540050187b12",
        "9fe2b6a0-58b1-483e-9298-7219a3f35881",
        "15817581-8dc9-44e5-8db9-d1760c2a1680",
        "66ecd14a-5656-4e36-86cc-544fb1486c8a",
        "671e4e62-0fca-4c47-ba54-a3e9d70a57f1",
        "4334fc8f-28bf-44fe-ac8a-fecd9fd01360",
        "1e524e91-e304-4d45-8ec9-0ab7990baf37",
        "f4fbaa95-5898-414c-a67f-3a8a0dffc63a",
        "366fd5fb-f058-4fee-ac2e-7ef69ccb50cf",
        "7cc78dd8-bac0-4cc3-8376-f55293b171d7",
        "4865ec1d-7f58-4e53-a3f5-eff14d81deab",
        "1eaaa7ff-e51c-4c72-bd3a-fa3843ee097a",
        "53a3be79-cb48-4659-a693-3f8e8e5c19ae",
        "940749bf-ca68-4ed8-a39c-a61068560210",
        "ba13eac4-d960-4c3e-a755-c75dab07f554",
        "d1694590-b76b-4a31-9214-06199405381a",
        "43887aeb-2602-4275-ba35-64da8604fd85",
        "6de32f40-ced4-4c01-9c8f-7ae7ce88d908",
        "15bcd69f-a95c-433a-bc57-a95f4a25ea31",
        "805bf0d2-ec4f-48f8-b168-385909809967",
        "aa003b29-8104-4742-8519-66a2b52b8518",
        "c2ca6392-5d0f-4006-94f0-7789b8ac3b43",
        "f23f6ad3-f74e-47b6-ad00-026726cc6d7a",
        "2918f718-08b0-4962-bbd8-26f580d2f82e",
        "805afa1b-f071-412b-94cf-fe5ad470fa2c",
        "d27f4170-9a1c-4d81-96fb-ec8dc987d506",
        "dfd44b49-003f-4a8e-bf08-4a5a4cf112e1",
        "4654f0e5-09b2-419e-982a-3a0ca41cc4af",
        "96baf813-bede-4f8e-8583-92b33c0f04df",
        "3da70f06-b989-4e36-8136-80273f792e00",
        "d4e3f49d-46cb-4ffa-bf4e-d690386590df",
        "5877869d-25c2-4ee1-bfb7-d3b1d8fb4402",
        "14bf035e-bbe2-48b4-9857-bb767330f41a",
        "41ee9c80-99a9-4ab4-aa4a-0bfe4f138dde",
        "8ad1e718-dcbe-40f6-815f-6f55b48a657a",
        "a6c4e730-81ec-49ef-be16-befa4128eef6",
        "b1a98573-1e01-4b7d-ad5d-d74b9c9ad6db",
        "5642c448-152b-4a25-a53f-1448cf4b208a",
        "6d186dd5-e333-417c-8a7b-a52f4077f4df",
        "99ac6e7d-6e93-4026-b7b7-ae4e39e66185",
        "00af31b9-d136-46b4-b141-619d73490f61",
        "9ee6b6b1-a444-44f8-8aa1-91ec5a14e010",
        "0eb2715e-0c31-40bb-8aea-b238a2f902e4",
        "9fdffa04-d51b-4eac-bb28-57e56135426a",
        "9f7e8a45-dee1-4c39-9c26-fe45a400ab9a",
        "303f4fff-1572-4b7f-adc1-a03cc2f74764",
        "d57f75a3-5618-4633-b610-abb82476b543",
        "a13bc2ab-4a3a-4329-9d5a-3d4b6800f9b3",
        "d217c838-81b2-4886-85f4-6631bf27af52",
        "65a0775c-160b-4924-b899-3211b3d1cfab",
        "da0ecf94-f7bb-45c4-a952-f4ca732a2aa0",
        "d021082a-a8df-49ab-8a25-d7231c7b1672",
        "4ea4b2e2-7152-45c5-af6d-993fb415333a",
        "d3b8c840-f927-4fb5-8819-b98d58085184",
        "e690f4a4-9c9d-4534-aaa3-aed66f8c68ad",
        "3f6d424d-5d8d-4280-ab5f-c28ab795cf9d",
        "8a0f601d-8ed3-4b59-8df3-a39e1ca8ef79",
        "d5207f73-9cfe-4b5e-9b49-f439f237a5d5",
        "79da66c2-e3c3-49a9-9107-925cb3d83470",
        "01cfc5bc-dca2-4143-9fd0-bf1ff0e07ec7",
        "033c5698-66db-458b-bc62-7ac679ec940a",
        "0d039a32-2b01-4d73-92cc-d9ee4e3290ff",
        "f7a3b988-d107-4e1c-8f5c-6be373912fb8",
        "312a5440-97e5-497f-8f26-1f364a00b8d2",
        "3e7121d1-8a5b-4c61-a583-39ab13cfa426",
        "dac3bce3-3df4-45bc-a05c-a98ee388232a",
        "31fd1082-0b07-42c4-95f5-f629c21df086",
        "d5acf229-e492-4d10-b31f-fd3e8bfc879e",
        "a3d67641-c513-4ceb-9a8d-d235d81dbd64",
        "f2a12543-4520-487b-8dc4-f66c89ca5c66",
        "484a8b49-df81-4887-a0ba-d039ea78f406",
        "4d5d51ca-31e5-4f2f-b3f7-963e727aa721",
        "ed92f7e8-f9ec-428f-8811-f6925679e222",
        "4bf3dabb-befd-4528-afaf-a8d61b56beb2",
        "912563d8-ed48-48af-967a-5d3776d51089",
        "d628d37c-3452-40de-8887-45c74bcfdeea",
        "d0827244-0c1b-47e7-af58-8ca8ab358ca0",
        "88781e6a-484e-41ee-88a2-c6138ab45247",
        "8748f18f-86c4-4fc8-a6e1-d69e738dfb45",
        "1b318fea-1235-4f00-abb7-f70dbe3a363b",
        "a3863760-52eb-4eb2-ab72-f6d4bbc563f6",
        "61a47b69-86cc-462f-abd4-f93e94f01050",
        "6b52f9d6-fe58-42cc-af6e-0f6fecaeb71e",
        "ddc36d80-2d50-4ae1-890d-07810db44cbf",
        "bdb4e50c-9eae-4b1c-b76e-46234babe549",
        "05e41208-5531-4326-a079-042487321e6f",
        "28ecd5bb-be12-446d-ac2a-5d191f8d5849",
        "c2e30629-b127-4678-bb94-0301a905f2ae",
        "f726218c-27c5-40ad-92bd-d1b28bf84375",
        "78d4720c-7324-4939-9c3b-257ed38172be",
        "498ec0a4-e509-4747-867a-ac0518b8a831",
        "d3d6166f-344b-4f07-9ca0-7891d2f37045",
        "42b3f918-19d5-4468-aaea-cce57b5cc09a",
        "bf486191-380c-4443-8183-c4134d2f9484",
        "cb43a1e0-3755-4fec-9a03-6b906caa701c",
        "ea03e85e-9d83-416d-83a5-c06c4ccdc2b3",
        "5e819d27-5182-4eab-b974-c4af7e8f1717",
        "0e38dcff-27cb-43df-9646-e63e65c6c69f",
        "2ad8ac54-e6b9-4097-8c02-531695ab3925",
        "a0e01759-b661-4f66-b022-7b8ea9383d0f",
        "0e60ff59-56a9-419f-8c0b-2642adb8866d",
        "13f53de5-ee07-4764-8f5d-9dfd449c9e3a",
        "46a02b15-edbb-4c68-a6cd-7c98ac681269",
        "2dd34b23-b0f9-4407-a3e5-138b01eec351",
        "089a6718-5dc2-4f48-9937-168a1c29896b",
        "13a57085-af4e-4119-b99d-cc1b52db3932",
        "bbeb653a-cf20-4c57-af6d-d65a317d115b",
        "cc9a0d39-f78b-43c0-883f-cc153ee5c4fe",
        "c8b64127-d46a-43a6-8309-4d2f8760a24c",
        "8484f6a1-373d-4b35-9766-44231ff7de18",
        "9408965c-743c-46bd-a7b2-0b091221f1a4",
        "57b04147-d1e3-4467-af39-f05b55efd00a",
        "39542379-c1f7-4fa5-aaad-a1e3cb5d7ab3",
        "81eff3ea-4063-45aa-9161-072191b6c915",
        "c2820916-c4ef-4bdd-9349-2af3bf06ce09",
        "631a6a7b-e23f-49cd-be61-e8eacf992154",
        "c09669a5-bff8-4ef3-8808-4c92435b7913",
        "17d935da-c175-4478-aeab-f8c208a4c23c",
        "9b74b073-d11a-4392-a12f-f7d1d06b6033",
        "0f450b2c-d4e8-4517-a944-52c340e60db8",
        "3016f8d8-1c81-4eda-ab6b-a2466c759aff",
        "3355a768-705a-481a-9c91-c7f24aeceef2",
        "554a41c7-d29b-4c5c-b34c-e09e799a745c",
        "560a89e6-4d3b-4afe-8d44-00c71b9d57c2",
        "673f3940-05c3-4762-b1f6-f5a8368551b8",
        "788e2180-2938-4c3d-9c40-d9768cb04b7e",
        "7fd82fef-aea7-488b-a29c-c58dc04a3e03",
        "cc852951-6c70-4ae5-9b10-7fa1b93f3e16",
        "835b5b28-d597-4ac3-a870-716a98df72d2",
        "bd76440e-90d4-4768-998c-422e503e7a6d",
        "5ce528d8-a2ae-47a0-b1c0-ca64c49203fc",
        "f304c0d3-fb08-40df-914c-6a172f199710",
        "06979f42-0f4a-40f9-9b62-93664cbcaa45",
        "b6e99fa6-5f9e-4857-8d7d-8f29d5e48552",
        "db01679f-f0e1-4a1e-a806-861b63dbddad",
        "3ea17aab-6bfb-4b0b-bb9f-54df80595250",
        "205d02f0-f002-48d4-b568-747be0e1d2e1",
        "9aa81401-c310-474a-ad71-954503149cf1",
        "c2edfd9e-3401-4fbb-aea8-fca1647a78d2",
        "97b00f30-6f37-4136-bb6e-e87af2267fa2",
        "11e77b50-38e4-4516-9aa1-ca43a541b922",
        "7e99bc2c-eb29-4859-a079-1a127e73c209",
        "af562675-6f24-4830-a9cf-9a546782f241",
        "f0c38a40-96da-4e7c-ae34-764ad5c61e83",
        "287837f6-e661-4637-b7a5-e1b7a46f1e1e",
        "a3a61f95-af6f-49a2-8895-188b22f35de7",
        "9fd48213-0d09-4e4c-8ed7-1d384b394215",
        "9c0a4063-f903-4df0-83fd-2e63052e50e2",
        "0c67535d-2421-46c6-b30b-139c645d0498",
        "1afe0317-1caf-42a8-b5fa-0a9804e29272",
        "86cf99d7-240f-492b-a1ca-9709929662c6",
        "3157fbc2-21d9-4995-afa1-05af301bc8c9",
        "e7cc5bdd-e13a-4d3c-83b7-f649df55a0ec",
        "3b784a8f-95e8-4216-bfba-b3d61afc67a9",
        "8399e256-b737-427f-9a1f-a1eb8f2796dc",
        "e60a0067-0556-4f42-96e8-49cbb3534a27",
        "fcd1c1a2-c3b6-499a-bde4-a0114b6b76dd",
        "ff59eb60-935b-49e9-b732-f35798c75815",
        "331a123d-a615-4bda-a9c0-4204fe933928",
        "00a92491-32cc-4453-b121-b178e1d340a9",
        "ed26b3a9-7487-4618-b9a5-020ebe389f12",
        "184e907f-48e0-45cc-b121-12561c1b0c37",
        "642bfe6f-14ae-4085-b55c-cf94ecc9e9e9",
        "a7ea9cac-a1ef-4028-9207-c2f60cf0bc08",
        "e599732a-6138-4501-90d7-4434b5d83d7b",
        "734b5c9b-0fef-4e69-a553-3e1addc9fa39",
        "14fdd3aa-f588-4540-b13c-3fe90f915adb",
        "0930d4b0-fab9-4f8c-8bcd-7f4b91f03429",
        "a18fc107-0f19-437e-aa8f-ad2d36e64fb0",
        "00880a50-89f5-4360-aabc-209f6ede4e74",
        "7e782446-c1bb-41fb-8201-0a7dd06efd24",
        "f0d0b359-601d-4c78-b4ff-68d8e0c44fff",
        "9bfced8e-8c45-4e74-bc85-987468283071",
        "93d6e9f9-b34b-4905-8bac-c37ae8c53bd8",
        "ab9e3469-f7cf-4928-b3da-177f3f9a3399",
        "30f9f8eb-6705-4f67-a23c-76aeea75899a",
        "28758af1-652d-4534-8dee-a93d10e6e84c",
        "6b31bcde-2e54-4788-9bcd-c55b25d6912c",
        "703c19e9-1b21-45ee-920e-c41ce93050d9",
        "35467730-1124-4bab-a90b-3a8a34eede1e",
        "8197021b-cd9e-459d-b03f-8ce8fd8a88be",
        "39c3ded2-3401-45e2-9224-4d3d61621272",
        "a0ee88ef-b2b5-4cb2-a96f-01bd0fe36fbf",
        "14103d64-9e37-4116-9416-61d7e2a816f0",
        "2f70f695-6dc5-4f29-8618-902477bf873c",
        "b6ce90d2-b64b-4491-a8c3-b8bc5feca0bf",
        "75cb85db-1832-4e61-9024-8ae42769497d",
        "e1597b73-6d00-48c8-911a-d60183f14dbe",
        "07038ca1-0244-492b-843b-d36e1aebf8ed",
        "29a26400-5c23-4561-843f-79759aff8f8a",
        "84f1f8ba-cd9f-49da-bd4a-a2b9f443a49d",
        "036e5419-5040-4b79-a7a3-d4632f98b948",
        "ed82d380-ad92-44cd-bbf7-567cc5d5417b",
        "27c2b166-d06c-45e7-a85c-e929135363d4",
        "6348f3c2-f448-4310-b9b5-33da930f1b59",
        "14cf97cf-9500-44e7-9f36-35467ebd0449",
        "ef4397f2-2192-46ac-a80e-05342f2d5d9e",
        "0d32c000-1d7a-48c6-bc24-3e30f39d1336",
        "562ca53b-dfa8-4fc2-aecf-e9b120e8a65b",
        "d22183aa-4cdc-4dd2-b4a6-5d878b4873c3",
        "31451382-bf9c-40d4-9245-19742ccd479d",
        "aed3488d-cb41-4ea6-bf26-19c5e62f0de5",
        "5f9724a2-6495-4c19-8e62-7dc447fb6fbd",
        "18ed3d15-dc27-4bc1-811a-3e8f49cf02dd",
        "c0fbe45f-3546-4019-8f70-26b05fd32762"
      ],
      "reviewed": true,
      "provenance": "ACTUAL_PUBLIC_CATALOG_READ_ONLY",
      "catalogEvidence": {
        "status": "VERIFIED_SCOPED_READ_ONLY",
        "method": "EXPLICIT_DEVELOPMENT_BIBLIOGRAPHIC_REVIEW",
        "catalogRevision": "1793085366.781885",
        "observedAt": "2026-10-27T08:37:56.559909+00:00",
        "anchorId": "5844e0af-475c-4633-ba28-a5cfb9b5c9c5",
        "scopeSha256": "95afba73113535162cb48b9baea9f927aca27092adbe82670695e6ac87c09b8c",
        "facts": {
          "85711b71-33e1-49b5-b00c-50425645d08f": {
            "title": "The Ultimate Live Collection Vol. 19",
            "original_year": " "
          },
          "aab724cb-55ed-47b9-a9b6-d363b2c17555": {
            "title": "The Ultimate Live Collection Vol. 19",
            "original_year": " "
          },
          "4f28ae8d-f624-484d-91e5-317bc763328a": {
            "title": "The Ultimate Live Collection Vol. 01",
            "original_year": "1957"
          },
          "9880ba4e-1ffc-4e33-8a16-cbdff7a317d1": {
            "title": "The Ultimate Live Collection Vol. 01",
            "original_year": "1957"
          },
          "74d771ee-a964-4de9-b4a9-0d61b9b789e4": {
            "title": "1962 Live Recordings",
            "original_year": "1962"
          },
          "3e3a7104-6a6a-4d4c-a29c-14fdc48690dd": {
            "title": "First EMI Session",
            "original_year": "1962"
          },
          "9d80dab7-56aa-4bfa-bdba-7faee9c50c2a": {
            "title": "Live At The Star Club 1962 - Vol 1",
            "original_year": "1962"
          },
          "1ce67f49-c884-4f07-916f-cb2c982c8b39": {
            "title": "Live at the Star Club in Hamburg, Germany",
            "original_year": "1962"
          },
          "8a9c5819-a7a5-4bd4-8a0f-0646fe03d6d2": {
            "title": "New Year's Day - The Decca Audition",
            "original_year": "1962"
          },
          "87e6c4b4-68fd-4c52-8d52-29b7047affd4": {
            "title": "The Decca Tapes",
            "original_year": "1962"
          },
          "529cbd86-41cb-4d50-b20a-2aee7619a776": {
            "title": "The Early Tapes Of The Beatles",
            "original_year": "1962"
          },
          "157540d5-31d7-407b-9ee0-157f0c47c999": {
            "title": "Another Tracks Of With The Beatles '63",
            "original_year": "1963"
          },
          "f773523c-77f5-4a0c-bd30-cec08c6f2adf": {
            "title": "Live At Stockholm",
            "original_year": "1963"
          },
          "82769758-33aa-4e2a-843c-d0328e6237d0": {
            "title": "March 5, 1963 Complete Session Tape",
            "original_year": "1963"
          },
          "63bb5ce7-9476-4741-a2fe-6ac825074745": {
            "title": "Please Please Me",
            "original_year": "1963"
          },
          "bf56fdce-adf5-432e-b28f-6a4ba108dd0b": {
            "title": "Please Please Me",
            "original_year": "1963"
          },
          "0995d423-2e0f-4652-b8ee-61050b3dd905": {
            "title": "Please Please Me (2009 Remaster)",
            "original_year": "1963"
          },
          "2262c269-1e50-4a4b-93f2-7f4616bb7409": {
            "title": "Swedish Radio Show",
            "original_year": "1963"
          },
          "1bc07a92-9bf6-4d94-b809-c8df6cf730d8": {
            "title": "The Ultimate Live Collection Vol. 02",
            "original_year": "1963"
          },
          "8ee8c235-e133-4ce4-970c-01ce9a2faf52": {
            "title": "The Ultimate Live Collection Vol. 02",
            "original_year": "1963"
          },
          "69a0e6d4-92f0-4028-ac0b-24bec6cd663f": {
            "title": "With The Beatles",
            "original_year": "1963"
          },
          "dff3e52b-0e93-4d83-9c67-e9acba9497b5": {
            "title": "With The Beatles",
            "original_year": "1963"
          },
          "1a3215bb-4926-45b6-a6ee-e5f9cf2e3368": {
            "title": "With The Beatles (2009 Remaster)",
            "original_year": "1963"
          },
          "6d6015dd-2120-4045-85fd-08568971b342": {
            "title": "A Hard Day's Night",
            "original_year": "1964"
          },
          "c1ff77a5-9528-4154-bfb4-ae4bfa866210": {
            "title": "A Hard Day's Night",
            "original_year": "1964"
          },
          "84d3fd4d-4c25-4c98-b8ea-9d9ff86dfd2a": {
            "title": "A Hard Day's Night (2009 Remaster)",
            "original_year": "1964"
          },
          "6d4e0197-2139-42fc-9a17-d9b1d09cdfa9": {
            "title": "Back With Us Now, Ringo - June 1964",
            "original_year": "1964"
          },
          "e6762b4c-d153-405b-986a-6d2779591831": {
            "title": "Back With Us Now, Ringo - June 1964",
            "original_year": "1964"
          },
          "e46336df-bf04-4216-b21a-640e1e8f7406": {
            "title": "Beatles For Sale",
            "original_year": "1964"
          },
          "315e0dea-4818-4c44-aac5-4da1f8979a7a": {
            "title": "Beatles For Sale ",
            "original_year": "1964"
          },
          "678061eb-3afd-46ba-a455-ffc4113d57d4": {
            "title": "Beatles For Sale (2009 Remaster)",
            "original_year": "1964"
          },
          "3e994dc2-687a-4634-8c76-d2a3ad67223a": {
            "title": "Beatles with Tony Sheridan & T",
            "original_year": "1964"
          },
          "cea9a9b7-c3e5-4f4b-9f70-1e81a9fad7c4": {
            "title": "First U.S. Concert",
            "original_year": "1964"
          },
          "61ee5d55-f21f-4a3e-a5b9-277e260769d2": {
            "title": "Live In Convention Hall Philadelphia September 2 1964",
            "original_year": "1964"
          },
          "b670696e-3f7a-49e6-98d4-74c15ee24afc": {
            "title": "Live In Denmark And Nederland",
            "original_year": "1964"
          },
          "503d36cc-8443-42aa-bc3a-6d876bf55ee2": {
            "title": "Live In Vancouver",
            "original_year": "1964"
          },
          "fd3e0945-6e92-48a2-8b9a-edf997b90d7a": {
            "title": "Live In Washington 1964",
            "original_year": "1964"
          },
          "cdfee396-1edd-4e43-8f9b-09534f2910a3": {
            "title": "Northwest Nights (Seattle)",
            "original_year": "1964"
          },
          "1f3c59aa-eb57-412a-bc52-51552b5b9b41": {
            "title": "The Savage Young Beatles",
            "original_year": "1964"
          },
          "8e665ff1-c814-428b-8d2b-19ec88a25bfe": {
            "title": "The Ultimate Live Collection Vol. 03",
            "original_year": "1964"
          },
          "c4b39f57-924a-45fb-af12-15b4930063f5": {
            "title": "The Ultimate Live Collection Vol. 03",
            "original_year": "1964"
          },
          "2c8f00a3-fa38-4f97-a310-bf359dae2537": {
            "title": "The Ultimate Live Collection Vol. 04",
            "original_year": "1964"
          },
          "a9e0f549-b5de-42c2-bc7a-44a4d29bc4b9": {
            "title": "The Ultimate Live Collection Vol. 04",
            "original_year": "1964"
          },
          "19f1be24-2ef1-490b-916d-6abf528146dc": {
            "title": "The Ultimate Live Collection Vol. 05",
            "original_year": "1964"
          },
          "5d2bdd9e-ddd7-49d5-b039-f08929fcf44f": {
            "title": "The Ultimate Live Collection Vol. 05",
            "original_year": "1964"
          },
          "0fa7a5a4-3bb1-4795-945a-d8c08b777c23": {
            "title": "The Ultimate Live Collection Vol. 06",
            "original_year": "1964"
          },
          "ccd0c481-f645-4365-93cf-d8a83d67b688": {
            "title": "The Ultimate Live Collection Vol. 06",
            "original_year": "1964"
          },
          "37b7adf3-4b24-42c6-92e4-83d0d1bdde15": {
            "title": "The Ultimate Live Collection Vol. 08",
            "original_year": "1964"
          },
          "5fe02d8f-53c6-4768-85fe-680edea9b040": {
            "title": "The Ultimate Live Collection Vol. 08",
            "original_year": "1964"
          },
          "497990d1-2ad5-4a98-9194-92953bf1492f": {
            "title": "The Ultimate Live Collection Vol. 10",
            "original_year": "1964"
          },
          "4b29f8de-6d2f-458f-a43d-f34eacb062a8": {
            "title": "The Ultimate Live Collection Vol. 10",
            "original_year": "1964"
          },
          "2f5342db-1123-4c38-88aa-3d1c0d508db5": {
            "title": "The Ultimate Live Collection Vol. 11",
            "original_year": "1964"
          },
          "c61aad4d-0d31-4fdd-ada0-e1a7b99e6283": {
            "title": "The Ultimate Live Collection Vol. 11",
            "original_year": "1964"
          },
          "7ac29294-75ac-434d-8c73-95340d5c78de": {
            "title": "Meet The Beatles! (2014 Remaster)",
            "original_year": "1964-01-20"
          },
          "09906857-7980-45d9-b6b8-be5c053bd2d9": {
            "title": "The Beatles' Second Album (2014 Remaster)",
            "original_year": "1964-04-10"
          },
          "d0256347-a5b8-447d-b5c1-9ed5864cffa2": {
            "title": "A Hard Day's Night (2014 Remaster)",
            "original_year": "1964-06-26"
          },
          "beee8da2-4145-4b88-b264-18b6c19bc137": {
            "title": "Something New (2014 Remaster)",
            "original_year": "1964-07-20"
          },
          "b1e3bd3d-864e-4aea-9990-b257d5f14cb9": {
            "title": "The Beatles Story (2014 Remaster)",
            "original_year": "1964-11-23"
          },
          "65d7b365-d427-45a8-930d-835ba2f10c3a": {
            "title": "Beatles '65 (2014 Remaster)",
            "original_year": "1964-12-15"
          },
          "bbf22d14-f478-47cd-a527-ddb3bffeaf7d": {
            "title": "Help!",
            "original_year": "1965"
          },
          "dfc04ff3-60f8-416d-8a2c-16e9e04305cf": {
            "title": "Help!",
            "original_year": "1965"
          },
          "ac59da40-5d4b-4336-8309-7a233ea8080c": {
            "title": "Help! (2009 Remaster)",
            "original_year": "1965"
          },
          "e5a0788d-187d-49b2-b6de-8fb497d534ab": {
            "title": "Help! (24-Bit Remaster)",
            "original_year": "1965"
          },
          "443b96c2-ab6b-4070-b38f-feeae239852f": {
            "title": "Live Palais Des Sports, Paris - June 20, 1965",
            "original_year": "1965"
          },
          "ebb16139-1aee-4ef2-a35d-57c7a1cfc2dc": {
            "title": "Over Atlanta & Shea",
            "original_year": "1965"
          },
          "1fcbf642-3888-4c68-bb05-eae0c93b1002": {
            "title": "Rubber Soul",
            "original_year": "1965"
          },
          "90e59ade-3ae8-4ba6-a05d-f52a0d5a011e": {
            "title": "Rubber Soul",
            "original_year": "1965"
          },
          "4ca5ec37-bf35-4995-81fa-b488cb613e11": {
            "title": "Rubber Soul (2009 Remaster)",
            "original_year": "1965"
          },
          "ce03de40-8eba-4a0e-ab98-d702353ecd60": {
            "title": "The Ultimate Live Collection Vol. 12",
            "original_year": "1965"
          },
          "fe473fc1-90b8-4362-b5a3-259feb97437c": {
            "title": "The Ultimate Live Collection Vol. 12",
            "original_year": "1965"
          },
          "5859b4fe-cb27-4cbe-9dc3-a456bfa09664": {
            "title": "The Ultimate Live Collection Vol. 13",
            "original_year": "1965"
          },
          "acd8ca69-6eba-4eb3-a8c5-40e6d43c9ed8": {
            "title": "The Ultimate Live Collection Vol. 13",
            "original_year": "1965"
          },
          "6cc0591d-4152-44e9-be2d-ba694b1661bd": {
            "title": "The Ultimate Live Collection Vol. 15",
            "original_year": "1965"
          },
          "f4ee5544-76fa-49d5-aa76-4ccaa8ec65b7": {
            "title": "The Ultimate Live Collection Vol. 15",
            "original_year": "1965"
          },
          "6288eebc-f024-444c-9df1-cb4c947fe65d": {
            "title": "The Ultimate Live Collection Vol. 16",
            "original_year": "1965"
          },
          "b816a045-50a9-4514-ad05-365e8f994f04": {
            "title": "The Ultimate Live Collection Vol. 16",
            "original_year": "1965"
          },
          "3e5d04df-16ca-4b1b-9d7d-554463b5f535": {
            "title": "The Early Beatles (2014 Remaster)",
            "original_year": "1965-03-22"
          },
          "11cd5321-dbba-4dbb-a5cc-769a8f6c3906": {
            "title": "Beatles VI (2014 Remaster)",
            "original_year": "1965-06-14"
          },
          "4886b7db-3a2b-4e0e-8241-d95493728748": {
            "title": "Help! (2014 Remaster)",
            "original_year": "1965-08-13"
          },
          "49d5c72f-915a-44f9-83f9-09368893d458": {
            "title": "Rubber Soul (2014 Remaster)",
            "original_year": "1965-12-06"
          },
          "31ee7c2c-75ec-4ba7-88c2-aabfe0f7571c": {
            "title": "Concert At Budokan 1966",
            "original_year": "1966"
          },
          "d8a8f8cb-5455-491f-85b8-2d5e894bd130": {
            "title": "Live In Japan July 1 1966",
            "original_year": "1966"
          },
          "4092cd0a-0df3-472a-89dc-5b4b40ad0070": {
            "title": "Live In Japan June 30 1964",
            "original_year": "1966"
          },
          "518996fb-cc95-4999-95a4-02f8604f5011": {
            "title": "Revolver",
            "original_year": "1966"
          },
          "7580337e-8d69-40b1-b38c-7854efdfcd59": {
            "title": "Revolver",
            "original_year": "1966"
          },
          "382f688f-ce48-4987-bfb7-6bb3fe702812": {
            "title": "Revolver (2009 Remaster)",
            "original_year": "1966"
          },
          "e29e00fe-1022-41c1-b6b0-149a8a3e830c": {
            "title": "Revolver (Purple Chick Deluxe Edition)",
            "original_year": "1966"
          },
          "d51cc5f6-1811-4232-a309-9477df234766": {
            "title": "The Live Beatles Tokio July 2, 1966",
            "original_year": "1966"
          },
          "46695b65-0dc2-4711-b6f5-872a3aea4de5": {
            "title": "The Ultimate Live Collection Vol. 18",
            "original_year": "1966"
          },
          "f5daba8a-38cd-4103-b250-1f51dcb960d3": {
            "title": "The Ultimate Live Collection Vol. 18",
            "original_year": "1966"
          },
          "49ec1d0e-06ba-4468-8998-7a5098d43130": {
            "title": "The Ultimate Live Collection Vol. 20",
            "original_year": "1966"
          },
          "d6d7caba-821d-4f1f-a78d-ebaaad3a2fb1": {
            "title": "The Ultimate Live Collection Vol. 20",
            "original_year": "1966"
          },
          "6ca8935f-2226-413d-b28b-76ebbb597462": {
            "title": "The Ultimate Live Collection Vol. 21",
            "original_year": "1966"
          },
          "e10e8f99-4f12-419b-b41a-ebfe03bb4532": {
            "title": "The Ultimate Live Collection Vol. 21",
            "original_year": "1966"
          },
          "2553e60f-aa2e-44aa-aa15-74eeb9a3d5c7": {
            "title": "Yesterday And Today (2014 Remaster)",
            "original_year": "1966-06-20"
          },
          "b7d0ce2c-38de-4dfa-b7de-981570d94a6a": {
            "title": "Revolver (2014 Remaster)",
            "original_year": "1966-08-08"
          },
          "3f131935-d599-4da5-a65b-f11d5da3c85c": {
            "title": "Alternate Sgt. Pepper's Lonely Hearts Club Band",
            "original_year": "1967"
          },
          "2c21db67-024e-4358-a327-f4b2778f1a81": {
            "title": "Magical Mystery Tour",
            "original_year": "1967"
          },
          "7a56a486-d0af-4ae9-bd4b-80b0b5a2b601": {
            "title": "Magical Mystery Tour",
            "original_year": "1967"
          },
          "f1d66c91-0509-4f45-93f2-59b70915f820": {
            "title": "Magical Mystery Tour (2009 Remaster)",
            "original_year": "1967"
          },
          "101715e8-430b-4ca4-a247-4fe545f1fd59": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band",
            "original_year": "1967"
          },
          "55c04da6-7f0b-4db3-9036-e08beac9c655": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band",
            "original_year": "1967"
          },
          "a24561cd-784c-43be-857b-848be6424402": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band",
            "original_year": "1967"
          },
          "fdaff572-f65e-4062-ae30-bf219887e7fa": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band (2009 Remaster)",
            "original_year": "1967"
          },
          "c311cbfc-6ea2-496b-b75c-aabd54e2916f": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band (Purple Chick Deluxe Edition) [Bootleg]",
            "original_year": "1967"
          },
          "73d17d0b-de2c-4911-8dce-0c9cabcbebe2": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band (Super Deluxe Edition)",
            "original_year": "1967"
          },
          "0b51f697-8fad-4433-8bb6-8324154ef198": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band (Super Deluxe Edition)",
            "original_year": "1967-05-26"
          },
          "cd0d9416-a783-4853-9b8c-8765189a8c03": {
            "title": "Acoustic Masterpieces  (The Esher Demos - May '68)",
            "original_year": "1968"
          },
          "ad48ba3a-e8af-41c8-9759-ebfe8fea1379": {
            "title": "Artifacts: The Early Years",
            "original_year": "1968"
          },
          "38db5158-15c7-4059-a97a-4746b4dd1c5c": {
            "title": "Primal Colours (1968 Unreleased)",
            "original_year": "1968"
          },
          "67d92d7e-4133-4a1f-bbfb-440cec2744ba": {
            "title": "The Alternate White Album",
            "original_year": "1968"
          },
          "45867549-8b9d-4aa1-8429-a5caa762860f": {
            "title": "The Beatles",
            "original_year": "1968"
          },
          "526ba56c-c5d0-4a3b-8bf3-6bb601d4c36d": {
            "title": "The Beatles",
            "original_year": "1968"
          },
          "df35f85c-2f45-4742-bd17-92c60aac2345": {
            "title": "The Beatles",
            "original_year": "1968"
          },
          "f1200de4-0a78-4920-bde6-60a418d775b5": {
            "title": "The Beatles",
            "original_year": "1968"
          },
          "ea2ce42c-60c4-4e57-b4b7-486c26dca6a8": {
            "title": "White Album (Acoustic Sessions)",
            "original_year": "1968"
          },
          "2618c131-69e7-4cde-aac3-ccc41537a8c5": {
            "title": "The White Album",
            "original_year": "1968-11-22"
          },
          "5844e0af-475c-4633-ba28-a5cfb9b5c9c5": {
            "title": "Abbey Road",
            "original_year": "1969"
          },
          "6661cbcd-95b3-458f-be11-8c4137759646": {
            "title": "Abbey Road",
            "original_year": "1969"
          },
          "c1f6cc70-2a5b-4c5a-bc11-954d27c4f877": {
            "title": "Abbey Road",
            "original_year": "1969"
          },
          "d4646d53-dbd3-4020-9aa1-aa2a2c1c07c5": {
            "title": "Abbey Road (2009 Remaster)",
            "original_year": "1969"
          },
          "2b649ff0-91c8-474c-bd7a-d1b25e4071d9": {
            "title": "Get Back - 2nd Glyn John's Mix (Unreleased UK Stereo LP - Parlophone)",
            "original_year": "1969"
          },
          "3847cab8-3d0a-47c6-ac32-57333479483b": {
            "title": "Get Back, Glynis",
            "original_year": "1969"
          },
          "f5b3f586-2efb-4bb3-a078-6c816813bc9b": {
            "title": "Get Back, The Original Let it Be George Martin Mix",
            "original_year": "1969"
          },
          "cfed6d0a-e9c4-4349-8b38-9d9a44710a67": {
            "title": "Last Licks Live",
            "original_year": "1969"
          },
          "50e7b4c0-ffe2-4dc0-a73c-57d52e37ceee": {
            "title": "The Best Of The Twickenham Sessions Part One",
            "original_year": "1969"
          },
          "94b5db8e-05a0-46d7-8560-3277eece88ee": {
            "title": "Yellow Submarine",
            "original_year": "1969"
          },
          "dfd78a6a-2f88-49f3-9a71-6a0b2493e67a": {
            "title": "Yellow Submarine",
            "original_year": "1969"
          },
          "105b8e0f-d58b-421b-a49f-b044934141e8": {
            "title": "Yellow Submarine (2009 Remaster)",
            "original_year": "1969"
          },
          "61f17c44-b796-451d-9f6b-278f2f83fc60": {
            "title": "Abbey Road (24 BIT Remastered)",
            "original_year": "1969-09-26"
          },
          "d81dcb96-8277-47a3-8c4a-67f001a93847": {
            "title": "Get Back to Let It Be Session D'enregistrement",
            "original_year": "1970"
          },
          "17f638a9-794a-4231-ab18-0e2eceaa97ad": {
            "title": "Get Back, Glynis",
            "original_year": "1970"
          },
          "9d7fbcca-1c6b-4d7a-954f-212308494c16": {
            "title": "Hey Jude (Parlophone Vinyl)",
            "original_year": "1970"
          },
          "f06e101b-0913-4427-a7ad-aa964a9406d8": {
            "title": "Hey Jude (Parlophone Vinyl)",
            "original_year": "1970"
          },
          "74f2cbc1-07bd-4659-a981-461553be039c": {
            "title": "Let It Be",
            "original_year": "1970"
          },
          "ac614867-fdd0-480e-9bca-61de79179df5": {
            "title": "Let It Be",
            "original_year": "1970"
          },
          "f2a518f5-f8bc-438e-b634-74be59f50b9a": {
            "title": "Let It Be",
            "original_year": "1970"
          },
          "f89d0919-225e-4618-aac3-7c6df10e6fd5": {
            "title": "Let It Be (2009 Remaster)",
            "original_year": "1970"
          },
          "e7c9d886-b08c-4bb0-a0c3-540050187b12": {
            "title": "No. 1",
            "original_year": "1970"
          },
          "9fe2b6a0-58b1-483e-9298-7219a3f35881": {
            "title": "Rooftop Session",
            "original_year": "1970"
          },
          "15817581-8dc9-44e5-8db9-d1760c2a1680": {
            "title": "Hey Jude (2014 Remaster)",
            "original_year": "1970-02-26"
          },
          "66ecd14a-5656-4e36-86cc-544fb1486c8a": {
            "title": "Let It Be (50th Anniversary, Super Deluxe)",
            "original_year": "1970-05-08"
          },
          "671e4e62-0fca-4c47-ba54-a3e9d70a57f1": {
            "title": "1962 - 1966",
            "original_year": "1973"
          },
          "4334fc8f-28bf-44fe-ac8a-fecd9fd01360": {
            "title": "1967 - 1970",
            "original_year": "1973"
          },
          "1e524e91-e304-4d45-8ec9-0ab7990baf37": {
            "title": "The Blue Album 1967-1970",
            "original_year": "1973"
          },
          "f4fbaa95-5898-414c-a67f-3a8a0dffc63a": {
            "title": "The Red Album 1962-1965",
            "original_year": "1973"
          },
          "366fd5fb-f058-4fee-ac2e-7ef69ccb50cf": {
            "title": "Rock 'n' Roll Music (Us Stereo",
            "original_year": "1976"
          },
          "7cc78dd8-bac0-4cc3-8376-f55293b171d7": {
            "title": "Live At Hollywood Bowl",
            "original_year": "1977"
          },
          "4865ec1d-7f58-4e53-a3f5-eff14d81deab": {
            "title": "Love Songs",
            "original_year": "1977"
          },
          "1eaaa7ff-e51c-4c72-bd3a-fa3843ee097a": {
            "title": "The Alternate Abbey Road",
            "original_year": "1978"
          },
          "53a3be79-cb48-4659-a693-3f8e8e5c19ae": {
            "title": "Ballads {SP}",
            "original_year": "1980"
          },
          "940749bf-ca68-4ed8-a39c-a61068560210": {
            "title": "Ballads {SP}",
            "original_year": "1980"
          },
          "ba13eac4-d960-4c3e-a755-c75dab07f554": {
            "title": "Turn Me On Dead Man",
            "original_year": "1982"
          },
          "d1694590-b76b-4a31-9214-06199405381a": {
            "title": "Turn Me On Dead Man",
            "original_year": "1982"
          },
          "43887aeb-2602-4275-ba35-64da8604fd85": {
            "title": "Sessions (Unreleased By Capitol)",
            "original_year": "1985"
          },
          "6de32f40-ced4-4c01-9c8f-7ae7ce88d908": {
            "title": "Not For Sale",
            "original_year": "1986"
          },
          "15bcd69f-a95c-433a-bc57-a95f4a25ea31": {
            "title": "Past Masters",
            "original_year": "1988"
          },
          "805bf0d2-ec4f-48f8-b168-385909809967": {
            "title": "Past Masters - Volume One",
            "original_year": "1988"
          },
          "aa003b29-8104-4742-8519-66a2b52b8518": {
            "title": "Past Masters - Volume Two",
            "original_year": "1988"
          },
          "c2ca6392-5d0f-4006-94f0-7789b8ac3b43": {
            "title": "Past Masters, Vol. 1",
            "original_year": "1988"
          },
          "f23f6ad3-f74e-47b6-ad00-026726cc6d7a": {
            "title": "Past Masters, Vol. 1",
            "original_year": "1988"
          },
          "2918f718-08b0-4962-bbd8-26f580d2f82e": {
            "title": "Past Masters, Vol. 2",
            "original_year": "1988"
          },
          "805afa1b-f071-412b-94cf-fe5ad470fa2c": {
            "title": "Past Masters, Vol. 2",
            "original_year": "1988"
          },
          "d27f4170-9a1c-4d81-96fb-ec8dc987d506": {
            "title": "Five Nights In A Judo Arena",
            "original_year": "1989"
          },
          "dfd44b49-003f-4a8e-bf08-4a5a4cf112e1": {
            "title": "In The Beginning",
            "original_year": "1989"
          },
          "4654f0e5-09b2-419e-982a-3a0ca41cc4af": {
            "title": "Ultra Rare Trax [Volume 1]",
            "original_year": "1989"
          },
          "96baf813-bede-4f8e-8583-92b33c0f04df": {
            "title": "Ultra Rare Trax [Volume 2]",
            "original_year": "1989"
          },
          "3da70f06-b989-4e36-8136-80273f792e00": {
            "title": "Ultra Rare Trax [Volume 3]",
            "original_year": "1989"
          },
          "d4e3f49d-46cb-4ffa-bf4e-d690386590df": {
            "title": "Ultra Rare Trax [Volume 4]",
            "original_year": "1989"
          },
          "5877869d-25c2-4ee1-bfb7-d3b1d8fb4402": {
            "title": "Ultra Rare Trax [Volume 5]",
            "original_year": "1989"
          },
          "14bf035e-bbe2-48b4-9857-bb767330f41a": {
            "title": "Ultra Rare Trax [Volume 6]",
            "original_year": "1989"
          },
          "41ee9c80-99a9-4ab4-aa4a-0bfe4f138dde": {
            "title": "Ultra Rare Trax [Volume 7]",
            "original_year": "1989"
          },
          "8ad1e718-dcbe-40f6-815f-6f55b48a657a": {
            "title": "Ultra Rare Trax [Volume 8]",
            "original_year": "1989"
          },
          "a6c4e730-81ec-49ef-be16-befa4128eef6": {
            "title": "Acetate Collection The Beatles",
            "original_year": "1990"
          },
          "b1a98573-1e01-4b7d-ad5d-d74b9c9ad6db": {
            "title": "Rubber Soul, The Alternate Mono Mixes",
            "original_year": "1990"
          },
          "5642c448-152b-4a25-a53f-1448cf4b208a": {
            "title": "Abbey Road NW8 #3",
            "original_year": "1991"
          },
          "6d186dd5-e333-417c-8a7b-a52f4077f4df": {
            "title": "Get Back and 22 Other Songs",
            "original_year": "1991"
          },
          "99ac6e7d-6e93-4026-b7b7-ae4e39e66185": {
            "title": "Over Atlanta & Shea",
            "original_year": "1991"
          },
          "00af31b9-d136-46b4-b141-619d73490f61": {
            "title": "Silver Edition Vol. 1",
            "original_year": "1992"
          },
          "9ee6b6b1-a444-44f8-8aa1-91ec5a14e010": {
            "title": "Arrive Without Aging",
            "original_year": "1993"
          },
          "0eb2715e-0c31-40bb-8aea-b238a2f902e4": {
            "title": "Artifacts (1of3) Disc 1 of 5 (The Early Years 1958-1963)",
            "original_year": "1993"
          },
          "9fdffa04-d51b-4eac-bb28-57e56135426a": {
            "title": "Artifacts (1of3) Disc 2 of 5 (Beatlemania 1964-1965)",
            "original_year": "1993"
          },
          "9f7e8a45-dee1-4c39-9c26-fe45a400ab9a": {
            "title": "Artifacts (1of3) Disc 3 of 5 (The Psychedelics Years 1966-1967)",
            "original_year": "1993"
          },
          "303f4fff-1572-4b7f-adc1-a03cc2f74764": {
            "title": "Artifacts (1of3) Disc 4 of 5 (Inner Revolution 1968)",
            "original_year": "1993"
          },
          "d57f75a3-5618-4633-b610-abb82476b543": {
            "title": "Artifacts (1of3) Disc 5 of 5 (Get Back To Abbey Road 1969-1970)",
            "original_year": "1993"
          },
          "a13bc2ab-4a3a-4329-9d5a-3d4b6800f9b3": {
            "title": "Artifacts (2of3) Disc 1 of 5 (Youngblood 1960-1963)",
            "original_year": "1993"
          },
          "d217c838-81b2-4886-85f4-6631bf27af52": {
            "title": "Artifacts (2of3) Disc 2 of 5 (Ticket To Ride 1964-1965)",
            "original_year": "1993"
          },
          "65a0775c-160b-4924-b899-3211b3d1cfab": {
            "title": "Artifacts (2of3) Disc 3 of 5 (Northern Song 1966-1967)",
            "original_year": "1993"
          },
          "da0ecf94-f7bb-45c4-a952-f4ca732a2aa0": {
            "title": "Artifacts (2of3) Disc 4 of 5 (Alone Together 1968)",
            "original_year": "1993"
          },
          "d021082a-a8df-49ab-8a25-d7231c7b1672": {
            "title": "Artifacts (2of3) Disc 5 of 5 (The Longest Road 1969)",
            "original_year": "1993"
          },
          "4ea4b2e2-7152-45c5-af6d-993fb415333a": {
            "title": "The Peter Sellers Tape",
            "original_year": "1993"
          },
          "d3b8c840-f927-4fb5-8819-b98d58085184": {
            "title": "Artifacts II - Vol. 3 (Northern Songs 1966-1967)",
            "original_year": "1994"
          },
          "e690f4a4-9c9d-4534-aaa3-aed66f8c68ad": {
            "title": "As Nature Intended",
            "original_year": "1994"
          },
          "3f6d424d-5d8d-4280-ab5f-c28ab795cf9d": {
            "title": "Live At The BBC",
            "original_year": "1994"
          },
          "8a0f601d-8ed3-4b59-8df3-a39e1ca8ef79": {
            "title": "Live At The BBC",
            "original_year": "1994"
          },
          "d5207f73-9cfe-4b5e-9b49-f439f237a5d5": {
            "title": "The Lost Pepperland Reel",
            "original_year": "1994"
          },
          "79da66c2-e3c3-49a9-9107-925cb3d83470": {
            "title": "The Sweetest Apples (Ultimate Rarities 1967-70)",
            "original_year": "1994"
          },
          "01cfc5bc-dca2-4143-9fd0-bf1ff0e07ec7": {
            "title": "12\" Baby It's You",
            "original_year": "1995"
          },
          "033c5698-66db-458b-bc62-7ac679ec940a": {
            "title": "Acoustic Submarine",
            "original_year": "1995"
          },
          "0d039a32-2b01-4d73-92cc-d9ee4e3290ff": {
            "title": "Anthology 1",
            "original_year": "1995"
          },
          "f7a3b988-d107-4e1c-8f5c-6be373912fb8": {
            "title": "Anthology 2",
            "original_year": "1996"
          },
          "312a5440-97e5-497f-8f26-1f364a00b8d2": {
            "title": "Anthology 3",
            "original_year": "1996"
          },
          "3e7121d1-8a5b-4c61-a583-39ab13cfa426": {
            "title": "Wildcat!",
            "original_year": "1996"
          },
          "dac3bce3-3df4-45bc-a05c-a98ee388232a": {
            "title": "Wildcat!",
            "original_year": "1996"
          },
          "31fd1082-0b07-42c4-95f5-f629c21df086": {
            "title": "Alternate Abby Road",
            "original_year": "1997"
          },
          "d5acf229-e492-4d10-b31f-fd3e8bfc879e": {
            "title": "The Alternate Revolver",
            "original_year": "1997"
          },
          "a3d67641-c513-4ceb-9a8d-d235d81dbd64": {
            "title": "Watching Rainbows",
            "original_year": "1997"
          },
          "f2a12543-4520-487b-8dc4-f66c89ca5c66": {
            "title": "Not Guilty",
            "original_year": "1998"
          },
          "484a8b49-df81-4887-a0ba-d039ea78f406": {
            "title": "30th Anniversary Radio Special",
            "original_year": "1999"
          },
          "4d5d51ca-31e5-4f2f-b3f7-963e727aa721": {
            "title": "30th Anniversary Radio Special",
            "original_year": "1999"
          },
          "ed92f7e8-f9ec-428f-8811-f6925679e222": {
            "title": "30th Anniversary Radio Special",
            "original_year": "1999"
          },
          "4bf3dabb-befd-4528-afaf-a8d61b56beb2": {
            "title": "For No One",
            "original_year": "1999"
          },
          "912563d8-ed48-48af-967a-5d3776d51089": {
            "title": "Yellow Submarine Songtrack",
            "original_year": "1999"
          },
          "d628d37c-3452-40de-8887-45c74bcfdeea": {
            "title": "Yellow Submarine Songtrack",
            "original_year": "1999"
          },
          "d0827244-0c1b-47e7-af58-8ca8ab358ca0": {
            "title": "1",
            "original_year": "2000"
          },
          "88781e6a-484e-41ee-88a2-c6138ab45247": {
            "title": "Acetates",
            "original_year": "2000"
          },
          "8748f18f-86c4-4fc8-a6e1-d69e738dfb45": {
            "title": "Black Album",
            "original_year": "2000"
          },
          "1b318fea-1235-4f00-abb7-f70dbe3a363b": {
            "title": "The Beatles Platinum",
            "original_year": "2000"
          },
          "a3863760-52eb-4eb2-ab72-f6d4bbc563f6": {
            "title": "Acetate Collection The Beatles",
            "original_year": "2001"
          },
          "61a47b69-86cc-462f-abd4-f93e94f01050": {
            "title": "Apple Singles Collection",
            "original_year": "2001"
          },
          "6b52f9d6-fe58-42cc-af6e-0f6fecaeb71e": {
            "title": "Rarities (US Mono-Strereo Ebbetts)",
            "original_year": "2001"
          },
          "ddc36d80-2d50-4ae1-890d-07810db44cbf": {
            "title": "30th Anniversary Radio Special CD 1 of 2",
            "original_year": "2002"
          },
          "bdb4e50c-9eae-4b1c-b76e-46234babe549": {
            "title": "Abbey Road Outtakes & Demos",
            "original_year": "2002"
          },
          "05e41208-5531-4326-a079-042487321e6f": {
            "title": "The Seven Years Of Christmas",
            "original_year": "2002"
          },
          "28ecd5bb-be12-446d-ac2a-5d191f8d5849": {
            "title": "Let It Be... Naked",
            "original_year": "2003"
          },
          "c2e30629-b127-4678-bb94-0301a905f2ae": {
            "title": "Blue Note plays THE BEATLES",
            "original_year": "2004"
          },
          "f726218c-27c5-40ad-92bd-d1b28bf84375": {
            "title": "Rubber Soul, The Alternate Mono Mixes",
            "original_year": "2004"
          },
          "78d4720c-7324-4939-9c3b-257ed38172be": {
            "title": "The Capitol Albums Vol. 1 Beatles '65",
            "original_year": "2004"
          },
          "498ec0a4-e509-4747-867a-ac0518b8a831": {
            "title": "The Capitol Albums Vol. 1 Meet The Beatles!",
            "original_year": "2004"
          },
          "d3d6166f-344b-4f07-9ca0-7891d2f37045": {
            "title": "The Capitol Albums Vol. 1 Something New",
            "original_year": "2004"
          },
          "42b3f918-19d5-4468-aaea-cce57b5cc09a": {
            "title": "The Capitol Albums Vol. 1 The Beatles' Second Album",
            "original_year": "2004"
          },
          "bf486191-380c-4443-8183-c4134d2f9484": {
            "title": "The Complete BBC Sessions Upgraded for 2004 - Disc 10",
            "original_year": "2004"
          },
          "cb43a1e0-3755-4fec-9a03-6b906caa701c": {
            "title": "The Ultimate Christmas Collection",
            "original_year": "2005"
          },
          "ea03e85e-9d83-416d-83a5-c06c4ccdc2b3": {
            "title": "This Bird Has Flown：A 40th Anniversary Tribute to Rubber Soul",
            "original_year": "2005"
          },
          "5e819d27-5182-4eab-b974-c4af7e8f1717": {
            "title": "Love",
            "original_year": "2006"
          },
          "0e38dcff-27cb-43df-9646-e63e65c6c69f": {
            "title": "The Capitol Albums Vol. 2 Beatles VI",
            "original_year": "2006"
          },
          "2ad8ac54-e6b9-4097-8c02-531695ab3925": {
            "title": "The Capitol Albums Vol. 2 Help!",
            "original_year": "2006"
          },
          "a0e01759-b661-4f66-b022-7b8ea9383d0f": {
            "title": "The Capitol Albums Vol. 2 Rubber Soul",
            "original_year": "2006"
          },
          "0e60ff59-56a9-419f-8c0b-2642adb8866d": {
            "title": "The Capitol Albums Vol. 2 The Early Beatles",
            "original_year": "2006"
          },
          "13f53de5-ee07-4764-8f5d-9dfd449c9e3a": {
            "title": "Yeah Yeah Yeah",
            "original_year": "2006"
          },
          "46a02b15-edbb-4c68-a6cd-7c98ac681269": {
            "title": "Abbey Road Deluxe Vol. 1",
            "original_year": "2007"
          },
          "2dd34b23-b0f9-4407-a3e5-138b01eec351": {
            "title": "Across the Universe [Deluxe Version]",
            "original_year": "2007"
          },
          "089a6718-5dc2-4f48-9937-168a1c29896b": {
            "title": "The Beatles – 2007 Rubber Soul",
            "original_year": "2007"
          },
          "13a57085-af4e-4119-b99d-cc1b52db3932": {
            "title": "Big Beat Box (Collectors Edition)",
            "original_year": "2008"
          },
          "bbeb653a-cf20-4c57-af6d-d65a317d115b": {
            "title": "A Hard Day's Night (24 BIT Remastered)",
            "original_year": "2009"
          },
          "cc9a0d39-f78b-43c0-883f-cc153ee5c4fe": {
            "title": "Abbey Road (24 BIT Remastered)",
            "original_year": "2009"
          },
          "c8b64127-d46a-43a6-8309-4d2f8760a24c": {
            "title": "Beatles For Sale (24 BIT Remastered)",
            "original_year": "2009"
          },
          "8484f6a1-373d-4b35-9766-44231ff7de18": {
            "title": "Easy Star's Lonely Hearts Dub Band",
            "original_year": "2009"
          },
          "9408965c-743c-46bd-a7b2-0b091221f1a4": {
            "title": "Help! (24 BIT Remastered)",
            "original_year": "2009"
          },
          "57b04147-d1e3-4467-af39-f05b55efd00a": {
            "title": "Let It Be (24 BIT Remastered)",
            "original_year": "2009"
          },
          "39542379-c1f7-4fa5-aaad-a1e3cb5d7ab3": {
            "title": "Magical Mystery Tour (24 BIT Remastered)",
            "original_year": "2009"
          },
          "81eff3ea-4063-45aa-9161-072191b6c915": {
            "title": "Past Masters (24 BIT Remastered)",
            "original_year": "2009"
          },
          "c2820916-c4ef-4bdd-9349-2af3bf06ce09": {
            "title": "Past Masters (24 BIT Remastered)",
            "original_year": "2009"
          },
          "631a6a7b-e23f-49cd-be61-e8eacf992154": {
            "title": "Please Please Me (24 BIT Remastered)",
            "original_year": "2009"
          },
          "c09669a5-bff8-4ef3-8808-4c92435b7913": {
            "title": "Revolver (24 BIT Remastered)",
            "original_year": "2009"
          },
          "17d935da-c175-4478-aeab-f8c208a4c23c": {
            "title": "Rubber Soul (24 BIT Remastered)",
            "original_year": "2009"
          },
          "9b74b073-d11a-4392-a12f-f7d1d06b6033": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band (24 BIT Remastered)",
            "original_year": "2009"
          },
          "0f450b2c-d4e8-4517-a944-52c340e60db8": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "3016f8d8-1c81-4eda-ab6b-a2466c759aff": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "3355a768-705a-481a-9c91-c7f24aeceef2": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "554a41c7-d29b-4c5c-b34c-e09e799a745c": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "560a89e6-4d3b-4afe-8d44-00c71b9d57c2": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "673f3940-05c3-4762-b1f6-f5a8368551b8": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "788e2180-2938-4c3d-9c40-d9768cb04b7e": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "7fd82fef-aea7-488b-a29c-c58dc04a3e03": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "cc852951-6c70-4ae5-9b10-7fa1b93f3e16": {
            "title": "The Beatles in Mono",
            "original_year": "2009"
          },
          "835b5b28-d597-4ac3-a870-716a98df72d2": {
            "title": "The Beatles In Mono Box Set 10 The Beatles",
            "original_year": "2009"
          },
          "bd76440e-90d4-4768-998c-422e503e7a6d": {
            "title": "The Beatles In Mono Box Set 11 Mono Masters",
            "original_year": "2009"
          },
          "5ce528d8-a2ae-47a0-b1c0-ca64c49203fc": {
            "title": "The White Album (24 BIT Remastered)",
            "original_year": "2009"
          },
          "f304c0d3-fb08-40df-914c-6a172f199710": {
            "title": "The White Album (24 BIT Remastered)",
            "original_year": "2009"
          },
          "06979f42-0f4a-40f9-9b62-93664cbcaa45": {
            "title": "With The Beatles (24 BIT Remastered)",
            "original_year": "2009"
          },
          "b6e99fa6-5f9e-4857-8d7d-8f29d5e48552": {
            "title": "Yellow Submarine (24 BIT Remastered)",
            "original_year": "2009"
          },
          "db01679f-f0e1-4a1e-a806-861b63dbddad": {
            "title": "Revolution´s Evolution",
            "original_year": "2010"
          },
          "3ea17aab-6bfb-4b0b-bb9f-54df80595250": {
            "title": "Revolving, The Revolver Sessions",
            "original_year": "2010"
          },
          "205d02f0-f002-48d4-b568-747be0e1d2e1": {
            "title": "I Saw Her Standing There",
            "original_year": "2013"
          },
          "9aa81401-c310-474a-ad71-954503149cf1": {
            "title": "I Saw Her Standing There",
            "original_year": "2013"
          },
          "c2edfd9e-3401-4fbb-aea8-fca1647a78d2": {
            "title": "Live At The BBC (Remaster 2013)",
            "original_year": "2013"
          },
          "97b00f30-6f37-4136-bb6e-e87af2267fa2": {
            "title": "On Air - Live At The BBC Volume 2",
            "original_year": "2013"
          },
          "11e77b50-38e4-4516-9aa1-ca43a541b922": {
            "title": "The Beatles And Solo Greatest Hits FLAC Collection",
            "original_year": "2013"
          },
          "7e99bc2c-eb29-4859-a079-1a127e73c209": {
            "title": "The Beatles And Solo Greatest Hits FLAC Collection",
            "original_year": "2013"
          },
          "af562675-6f24-4830-a9cf-9a546782f241": {
            "title": "A Hard Day's Night (UICY-76431) (2014 Remaster)",
            "original_year": "2014"
          },
          "f0c38a40-96da-4e7c-ae34-764ad5c61e83": {
            "title": "Beatles No. 5 (UICY-76432) (2014 Remaster)",
            "original_year": "2014"
          },
          "287837f6-e661-4637-b7a5-e1b7a46f1e1e": {
            "title": "Black Album",
            "original_year": "2014"
          },
          "a3a61f95-af6f-49a2-8895-188b22f35de7": {
            "title": "Help! (UICY-76433)  (2014 Remaster)",
            "original_year": "2014"
          },
          "9fd48213-0d09-4e4c-8ed7-1d384b394215": {
            "title": "Meet The Beatles (UICY-76429) (2014 Remaster)",
            "original_year": "2014"
          },
          "9c0a4063-f903-4df0-83fd-2e63052e50e2": {
            "title": "The Beatles Forever Greatest Hits",
            "original_year": "2014"
          },
          "0c67535d-2421-46c6-b30b-139c645d0498": {
            "title": "The Beatles' Second Album (UICY-76430) (2014 Remaster)",
            "original_year": "2014"
          },
          "1afe0317-1caf-42a8-b5fa-0a9804e29272": {
            "title": "The Black Album",
            "original_year": "2014"
          },
          "86cf99d7-240f-492b-a1ca-9709929662c6": {
            "title": "1+",
            "original_year": "2015"
          },
          "3157fbc2-21d9-4995-afa1-05af301bc8c9": {
            "title": "Zu Laut Special Edition Stereo",
            "original_year": "2015"
          },
          "e7cc5bdd-e13a-4d3c-83b7-f649df55a0ec": {
            "title": "Abbey Road And Beyond",
            "original_year": "2016"
          },
          "3b784a8f-95e8-4216-bfba-b3d61afc67a9": {
            "title": "Live At The Hollywood Bowl",
            "original_year": "2016"
          },
          "8399e256-b737-427f-9a1f-a1eb8f2796dc": {
            "title": "The Ultimate Live Collection Vol. 14",
            "original_year": "2016"
          },
          "e60a0067-0556-4f42-96e8-49cbb3534a27": {
            "title": "The Ultimate Live Collection Vol. 14",
            "original_year": "2016"
          },
          "fcd1c1a2-c3b6-499a-bde4-a0114b6b76dd": {
            "title": "The Ultimate Live Collection Vol. 14",
            "original_year": "2016"
          },
          "ff59eb60-935b-49e9-b732-f35798c75815": {
            "title": "The Ultimate Live Collection Vol. 14",
            "original_year": "2016"
          },
          "331a123d-a615-4bda-a9c0-4204fe933928": {
            "title": "The Ultimate Live Collection Vol. 22",
            "original_year": "2016"
          },
          "00a92491-32cc-4453-b121-b178e1d340a9": {
            "title": "The Ultimate Live Collection Vol. 23",
            "original_year": "2016"
          },
          "ed26b3a9-7487-4618-b9a5-020ebe389f12": {
            "title": "The Ultimate Live Collection Vol. 23",
            "original_year": "2016"
          },
          "184e907f-48e0-45cc-b121-12561c1b0c37": {
            "title": "The Ultimate Live Collection Vol. 24",
            "original_year": "2016"
          },
          "642bfe6f-14ae-4085-b55c-cf94ecc9e9e9": {
            "title": "The Ultimate Live Collection Vol. 24",
            "original_year": "2016"
          },
          "a7ea9cac-a1ef-4028-9207-c2f60cf0bc08": {
            "title": "The Ultimate Live Collection Vol. 22",
            "original_year": "2016 "
          },
          "e599732a-6138-4501-90d7-4434b5d83d7b": {
            "title": "The Beatles: Essentials",
            "original_year": "2018"
          },
          "734b5c9b-0fef-4e69-a553-3e1addc9fa39": {
            "title": "A Hard Day's Night (1964) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "14fdd3aa-f588-4540-b13c-3fe90f915adb": {
            "title": "Abbey Road (1969) - 5.1 Mono Collection 2 (2020)",
            "original_year": "2020"
          },
          "0930d4b0-fab9-4f8c-8bcd-7f4b91f03429": {
            "title": "Beatles For Sale (1964) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "a18fc107-0f19-437e-aa8f-ad2d36e64fb0": {
            "title": "Help! (1965) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "00880a50-89f5-4360-aabc-209f6ede4e74": {
            "title": "Let It Be (1970) - 5.1 Mono Collection 2 (2020)",
            "original_year": "2020"
          },
          "7e782446-c1bb-41fb-8201-0a7dd06efd24": {
            "title": "Magical Mystery Tour (1967) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "f0d0b359-601d-4c78-b4ff-68d8e0c44fff": {
            "title": "Mono Masters, Volume One (2009) - 5.1 Mono Collection 2 (2020)",
            "original_year": "2020"
          },
          "9bfced8e-8c45-4e74-bc85-987468283071": {
            "title": "Mono Masters, Volume Two (2009) - 5.1 Mono Collection 2 (2020)",
            "original_year": "2020"
          },
          "93d6e9f9-b34b-4905-8bac-c37ae8c53bd8": {
            "title": "Please Please Me (1963) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "ab9e3469-f7cf-4928-b3da-177f3f9a3399": {
            "title": "Revolver (1966) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "30f9f8eb-6705-4f67-a23c-76aeea75899a": {
            "title": "Rubber Soul (1965) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "28758af1-652d-4534-8dee-a93d10e6e84c": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band (1967) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "6b31bcde-2e54-4788-9bcd-c55b25d6912c": {
            "title": "The Beatles [White Album] (1968) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "703c19e9-1b21-45ee-920e-c41ce93050d9": {
            "title": "With The Beatles (1963) - 5.1 Mono Collection (2020)",
            "original_year": "2020"
          },
          "35467730-1124-4bab-a90b-3a8a34eede1e": {
            "title": "A Hard Day's Night (Remastered)",
            "original_year": "2021"
          },
          "8197021b-cd9e-459d-b03f-8ce8fd8a88be": {
            "title": "Abbey Road (Remastered)",
            "original_year": "2021"
          },
          "39c3ded2-3401-45e2-9224-4d3d61621272": {
            "title": "Beatles For Sale (Remastered)",
            "original_year": "2021"
          },
          "a0ee88ef-b2b5-4cb2-a96f-01bd0fe36fbf": {
            "title": "Get Back (Take 8)",
            "original_year": "2021"
          },
          "14103d64-9e37-4116-9416-61d7e2a816f0": {
            "title": "Help! (Remastered)",
            "original_year": "2021"
          },
          "2f70f695-6dc5-4f29-8618-902477bf873c": {
            "title": "Hours Of Darkness",
            "original_year": "2021"
          },
          "b6ce90d2-b64b-4491-a8c3-b8bc5feca0bf": {
            "title": "Hours Of Darkness",
            "original_year": "2021"
          },
          "75cb85db-1832-4e61-9024-8ae42769497d": {
            "title": "Let It Be (Remastered)",
            "original_year": "2021"
          },
          "e1597b73-6d00-48c8-911a-d60183f14dbe": {
            "title": "Let It Be (Super Deluxe)",
            "original_year": "2021"
          },
          "07038ca1-0244-492b-843b-d36e1aebf8ed": {
            "title": "Magical Mystery Tour (Remastered)",
            "original_year": "2021"
          },
          "29a26400-5c23-4561-843f-79759aff8f8a": {
            "title": "Past Masters (Remastered)",
            "original_year": "2021"
          },
          "84f1f8ba-cd9f-49da-bd4a-a2b9f443a49d": {
            "title": "Past Masters (Remastered)",
            "original_year": "2021"
          },
          "036e5419-5040-4b79-a7a3-d4632f98b948": {
            "title": "Please Please Me (Remastered)",
            "original_year": "2021"
          },
          "ed82d380-ad92-44cd-bbf7-567cc5d5417b": {
            "title": "Revolver (Remastered)",
            "original_year": "2021"
          },
          "27c2b166-d06c-45e7-a85c-e929135363d4": {
            "title": "Rubber Soul (Remastered)",
            "original_year": "2021"
          },
          "6348f3c2-f448-4310-b9b5-33da930f1b59": {
            "title": "Sgt. Pepper's Lonely Hearts Club Band (Remastered)",
            "original_year": "2021"
          },
          "14cf97cf-9500-44e7-9f36-35467ebd0449": {
            "title": "The White Album (Remastered)",
            "original_year": "2021"
          },
          "ef4397f2-2192-46ac-a80e-05342f2d5d9e": {
            "title": "The White Album (Remastered)",
            "original_year": "2021"
          },
          "0d32c000-1d7a-48c6-bc24-3e30f39d1336": {
            "title": "With The Beatles (Remastered)",
            "original_year": "2021"
          },
          "562ca53b-dfa8-4fc2-aecf-e9b120e8a65b": {
            "title": "Yellow Submarine (Remastered)",
            "original_year": "2021"
          },
          "d22183aa-4cdc-4dd2-b4a6-5d878b4873c3": {
            "title": "Get Back - The Rooftop Performance",
            "original_year": "2022"
          },
          "31451382-bf9c-40d4-9245-19742ccd479d": {
            "title": "Now And Then",
            "original_year": "2023"
          },
          "aed3488d-cb41-4ea6-bf26-19c5e62f0de5": {
            "title": "The Beatles 1962 – 1966 (2023 Edition)",
            "original_year": "2023"
          },
          "5f9724a2-6495-4c19-8e62-7dc447fb6fbd": {
            "title": "The Beatles 1967 – 1970 (2023 Edition)",
            "original_year": "2023"
          },
          "18ed3d15-dc27-4bc1-811a-3e8f49cf02dd": {
            "title": "Anthology 4",
            "original_year": "2025"
          },
          "c0fbe45f-3546-4019-8f70-26b05fd32762": {
            "title": "Anthology: Soundtrack to the Disney+ Series (Episodes 1-3)",
            "original_year": "2025-11-26"
          }
        }
      }
    },
    {
      "artistId": "ar_00000000-0000-4000-8000-000000000002",
      "catalogName": "John Lennon",
      "scope": "albums",
      "albumIds": [
        "6c0eee50-3fb2-4fe1-9ae8-1b121fb7948b",
        "4964a8c8-587d-4ccf-ae68-ba17ce1550f8",
        "ca6316ea-d998-42ae-93ba-586dce8b2734",
        "06f924d9-af1e-4bcc-bb1f-400c1cb8b229",
        "9d04c02f-92ae-4b6b-9fab-704b1a6daeb8",
        "1914786f-2817-487f-9783-ea8b0e4a1249",
        "a96d9e3a-e82e-4264-b8e1-22f42d9f8e32",
        "bf3802c2-dbb8-45ce-b651-17b0604e2dd5",
        "69733bb9-0670-41e5-84b1-2a2934e90dbc",
        "8ab33e5e-6652-41c6-83a7-7bf790d99b45",
        "505f7071-7b7a-421a-af51-4486d2be6112",
        "005438e1-43a1-4649-9a84-4903d67ac680",
        "42db33b8-646b-4e24-8694-6666cc2110f4",
        "7d01c2fb-cead-4d08-ba80-6600ea0a49fa",
        "1bc6c99e-140a-4b03-b004-76d5314d9a85",
        "b3df7f7d-cf23-40a5-b084-fe16ef704b8e",
        "fd1f27b7-3689-4642-9a58-3008d3d23df1",
        "ed3086f1-63ea-4f0e-8549-d5b08c07d63f",
        "2da9cb4e-8115-4f90-a80b-401b9e615a9e",
        "ae608fa4-320b-4d96-8dc3-06860011add2",
        "6f72d93f-507c-4194-906a-5ff4e97d2589",
        "06cbad4c-7c03-4553-97ad-eb13ec3f4c9a",
        "3ef24bd7-212b-48e1-a166-64d26bf77e3c",
        "3e29027d-8baf-4b25-896a-4cbc530894ed",
        "85fe98e5-44f1-4f52-9a87-430f0416658f",
        "cbddb8bb-2172-4b65-9aad-11a2f4a65198",
        "dfea5b42-6c3b-447a-b3fe-88d6c8339e27",
        "e4a5b8d5-42dd-486e-9625-db46822b1f6e",
        "7628b564-56ad-4716-af8a-ae2e84a23a03",
        "84054044-3665-464b-93fc-3cf314962e2c",
        "f8c39340-fec5-4984-8289-ec40708667cf",
        "2979fe88-a8dd-49c1-823b-124e1df815b4",
        "472ab69f-7d37-4d94-912f-a5405b0a066d",
        "097ca0e6-dd1c-42eb-9dd9-af6114690fc6",
        "91d7c3f4-0587-433f-a691-b8b3c6b66617",
        "9c6b6eff-197b-4aad-bda6-6f241a7483fe",
        "46199eef-3bd3-4c11-a487-165ed81a0d42",
        "8e2badaa-c4f3-480e-8abf-2990cc3d4cce",
        "30f530be-c03c-4212-b8d3-75f88aaa9e16",
        "0ed67b0f-41b4-42cc-9d47-620c4459ffc8",
        "cd5074c1-8349-40f2-9fcf-b112a6058bb0",
        "8bbe5073-1ec6-417f-b660-d7f6175200ad",
        "a987ef47-ff37-4a31-80b7-e0af0044e399",
        "d319b0b3-9f19-4b43-b285-0bf7c00acca6",
        "f05b253c-9d62-43e2-9ab3-96cf6361975c",
        "0b19541d-c105-4b11-822e-ae1a9cfdd805",
        "6a70bfc9-bb8f-49d8-bb8c-59026190b9cf",
        "5d393215-7265-4f4b-9c11-6de489434150",
        "3000c38c-4dc1-41b1-9d13-2aa59a2f12c5",
        "0fb82f34-461d-42c2-a315-81ce9b30e64c",
        "7f13b9a8-737b-4884-ad79-c688bf4aa37a",
        "33eaf02a-e657-4840-a3ad-0b4dc758ec6a",
        "8306dec5-8589-4277-92c0-521b035ce2b0",
        "a144dae0-49f0-441c-a262-c01975f4ab0f",
        "20dc6902-2bd9-483c-bc60-0fc5266d0da1",
        "7dce273b-bacf-4445-8b79-a2d53274cec9",
        "72a59ed0-9209-4911-8d83-19cb931e2e84",
        "9ee261ca-cd97-4602-a579-940818d40925",
        "c951c81a-279f-4f18-9dcc-7a49d53d3002",
        "e23d83c1-b174-435a-835a-8a7833895427",
        "29cc8ab9-0812-4b06-9c0a-5db58c597b63",
        "f0ea4646-9c20-42cd-9876-de297c8b51ba",
        "f727714a-0833-4ef3-ada1-781ab69256cb",
        "ede748cc-3352-4493-a6cd-b0eee68a689d",
        "35d31730-e548-4c34-939e-9f3aba8f4fe3",
        "de504844-5440-45c4-a60f-247fa5ff6d72",
        "11c330cb-af0e-4d31-9f54-0a4a18430ac2",
        "928d1cce-ca3d-4bad-89a2-e4b997ef008f",
        "b6683989-965f-482b-a8d8-048268d26b37",
        "f92a3830-745b-43e4-a5c3-be7681529843",
        "f2ee7332-9a49-4a4b-b7c7-36f62a18eb46",
        "dc1f5ea1-c857-48e5-bc5a-e38f6cadc3de",
        "cb454742-e84d-443e-8e3f-308a94b9e923",
        "0ad3da2b-b87d-432f-b613-3d37aafe214e",
        "6a227054-94c7-4fa9-baee-362cc554457c",
        "599c940a-10ce-4a83-b2f5-f63199d3b6f5",
        "2b99a254-5741-4171-a5b5-706f0183163a",
        "cfd32006-383d-4a85-bb18-93fdf2382e7f",
        "a8e5e889-3716-4a18-907e-c74a1eb857f5",
        "290669a1-09c5-4bdf-8018-89cd082b9362",
        "7d95cdf1-f70c-42a7-ac07-10789b80e6f3",
        "cde59653-d85c-4d7f-a6a7-b29a9eabe295",
        "bbbc7011-0a7b-4162-baf2-3f22dbe01de3",
        "3bd73122-47f6-406d-b73f-e7a86e81a7c8",
        "1d8daaaa-5a97-43c1-a80d-aed277e74ef0",
        "dd6e07c4-bc15-4beb-94e0-297734031af2",
        "34d1c2f6-6fa1-46d5-8811-b378986847a4",
        "4c095f14-dd38-4dda-9a77-076a2ae92c7b",
        "e30c3116-90ab-4f1b-9183-dbdbaa9e996e",
        "d815fa94-73e9-4817-8e0e-fa7d50c02ab2",
        "c6b5319f-1b3f-45c9-8295-9d152dcd533b",
        "7da4ee3e-5603-4036-8ae5-2965eee0bc5e",
        "274e77a5-d6f9-4f1c-b45e-02e223981ce4",
        "9c24b817-66a1-4296-b808-cfcd93448b2b",
        "a2bafc54-1d1c-4b28-81d6-185ceefaa33c",
        "fa018f5f-8c8f-461d-8702-68b7821ee3e3",
        "7f509bb9-e951-4b23-9eef-84e5c6994c9a",
        "e4d43ae4-6687-4e08-afbc-cfb32f48396c",
        "3a726f2d-d5f9-49c2-b427-f36095e2fd3e",
        "53567fd1-3727-4d6c-917d-c68deeec6317",
        "f50e8d16-9b1f-424f-98fb-ac98afd5e87b",
        "3579b0af-52b3-4878-b414-02390efe64ae",
        "fcabbc00-7355-4135-9132-02a72e2090ed",
        "22cae293-d526-4fb3-80f7-eef73a962b8b",
        "c164cf90-94ea-46e6-a842-b38c10159341"
      ],
      "reviewed": true,
      "provenance": "ACTUAL_PUBLIC_CATALOG_READ_ONLY",
      "catalogEvidence": {
        "status": "VERIFIED_SCOPED_READ_ONLY",
        "method": "EXPLICIT_DEVELOPMENT_BIBLIOGRAPHIC_REVIEW",
        "catalogRevision": "1793085366.781885",
        "observedAt": "2026-10-27T08:37:56.559909+00:00",
        "anchorId": "2da9cb4e-8115-4f90-a80b-401b9e615a9e",
        "scopeSha256": "73bb66ccc313badb72b73da4e9d8bc1209d1e29aadd5b29df2b54c19fd0c425b",
        "facts": {
          "6c0eee50-3fb2-4fe1-9ae8-1b121fb7948b": {
            "title": "Unfinished Music No.1: Two Virgins",
            "original_year": "1968"
          },
          "4964a8c8-587d-4ccf-ae68-ba17ce1550f8": {
            "title": "Singles 1969-1975",
            "original_year": "1969"
          },
          "ca6316ea-d998-42ae-93ba-586dce8b2734": {
            "title": "Singles 1969-1975 (2010 Remaster)",
            "original_year": "1969"
          },
          "06f924d9-af1e-4bcc-bb1f-400c1cb8b229": {
            "title": "The Plastic Ono Band - Live Peace In Toronto 1969",
            "original_year": "1969"
          },
          "9d04c02f-92ae-4b6b-9fab-704b1a6daeb8": {
            "title": "Unfinished Music No.2: Life with the Lions",
            "original_year": "1969"
          },
          "1914786f-2817-487f-9783-ea8b0e4a1249": {
            "title": "Wedding Album",
            "original_year": "1969"
          },
          "a96d9e3a-e82e-4264-b8e1-22f42d9f8e32": {
            "title": "John Lennon / Plastic Ono Band (CDP 7 46770 2)",
            "original_year": "1970"
          },
          "bf3802c2-dbb8-45ce-b651-17b0604e2dd5": {
            "title": "John Lennon / Plastic Ono Band PT-SHM",
            "original_year": "1970"
          },
          "69733bb9-0670-41e5-84b1-2a2934e90dbc": {
            "title": "John Lennon Signature Box Set",
            "original_year": "1970"
          },
          "8ab33e5e-6652-41c6-83a7-7bf790d99b45": {
            "title": "John Lennon/Plastic Ono Band",
            "original_year": "1970"
          },
          "505f7071-7b7a-421a-af51-4486d2be6112": {
            "title": "John Lennon/Plastic Ono Band (2010 Remaster)",
            "original_year": "1970"
          },
          "005438e1-43a1-4649-9a84-4903d67ac680": {
            "title": "Plastic Ono Band",
            "original_year": "1970"
          },
          "42db33b8-646b-4e24-8694-6666cc2110f4": {
            "title": "Plastic Ono Band (MFSL UDCD 760)",
            "original_year": "1970"
          },
          "7d01c2fb-cead-4d08-ba80-6600ea0a49fa": {
            "title": "1971-09-10 Hotel Syracuse - Syracuse NY (John's 31st Birthday Party)",
            "original_year": "1971"
          },
          "1bc6c99e-140a-4b03-b004-76d5314d9a85": {
            "title": "Imagine",
            "original_year": "1971"
          },
          "b3df7f7d-cf23-40a5-b084-fe16ef704b8e": {
            "title": "Imagine",
            "original_year": "1971"
          },
          "fd1f27b7-3689-4642-9a58-3008d3d23df1": {
            "title": "Imagine",
            "original_year": "1971"
          },
          "ed3086f1-63ea-4f0e-8549-d5b08c07d63f": {
            "title": "Imagine (2010 Remaster)",
            "original_year": "1971"
          },
          "2da9cb4e-8115-4f90-a80b-401b9e615a9e": {
            "title": "Imagine (CDP 7 46641 2)",
            "original_year": "1971"
          },
          "ae608fa4-320b-4d96-8dc3-06860011add2": {
            "title": "Imagine (Japan CDP 746641 2)",
            "original_year": "1971"
          },
          "6f72d93f-507c-4194-906a-5ff4e97d2589": {
            "title": "Imagine (MFSL UDCD 759)",
            "original_year": "1971"
          },
          "06cbad4c-7c03-4553-97ad-eb13ec3f4c9a": {
            "title": "Imagine PT-SHM",
            "original_year": "1971"
          },
          "3ef24bd7-212b-48e1-a166-64d26bf77e3c": {
            "title": "Sometime In New York City",
            "original_year": "1971"
          },
          "3e29027d-8baf-4b25-896a-4cbc530894ed": {
            "title": "Sometime In New York City",
            "original_year": "1972"
          },
          "85fe98e5-44f1-4f52-9a87-430f0416658f": {
            "title": "Sometime In New York City",
            "original_year": "1972"
          },
          "cbddb8bb-2172-4b65-9aad-11a2f4a65198": {
            "title": "Sometime In New York City",
            "original_year": "1972"
          },
          "dfea5b42-6c3b-447a-b3fe-88d6c8339e27": {
            "title": "Sometime In New York City",
            "original_year": "1972"
          },
          "e4a5b8d5-42dd-486e-9625-db46822b1f6e": {
            "title": "Sometime In New York City",
            "original_year": "1972"
          },
          "7628b564-56ad-4716-af8a-ae2e84a23a03": {
            "title": "Sometime In New York City (Remastered)",
            "original_year": "1972"
          },
          "84054044-3665-464b-93fc-3cf314962e2c": {
            "title": "Mind Games",
            "original_year": "1973"
          },
          "f8c39340-fec5-4984-8289-ec40708667cf": {
            "title": "Mind Games (2010 Remaster)",
            "original_year": "1973"
          },
          "2979fe88-a8dd-49c1-823b-124e1df815b4": {
            "title": "Mind Games (CDP 7 46769 2)",
            "original_year": "1973"
          },
          "472ab69f-7d37-4d94-912f-a5405b0a066d": {
            "title": "Mind Games (MFSL UDCD 761)",
            "original_year": "1973"
          },
          "097ca0e6-dd1c-42eb-9dd9-af6114690fc6": {
            "title": "Mind Games PT-SHM",
            "original_year": "1973"
          },
          "91d7c3f4-0587-433f-a691-b8b3c6b66617": {
            "title": "A Toot And A Snore In '74",
            "original_year": "1974"
          },
          "9c6b6eff-197b-4aad-bda6-6f241a7483fe": {
            "title": "The Complete May Pang Tapes",
            "original_year": "1974"
          },
          "46199eef-3bd3-4c11-a487-165ed81a0d42": {
            "title": "Walls And Bridges",
            "original_year": "1974"
          },
          "8e2badaa-c4f3-480e-8abf-2990cc3d4cce": {
            "title": "Walls And Bridges (2010 Remaster)",
            "original_year": "1974"
          },
          "30f530be-c03c-4212-b8d3-75f88aaa9e16": {
            "title": "Walls And Bridges (CDP 7 46768 2)",
            "original_year": "1974"
          },
          "0ed67b0f-41b4-42cc-9d47-620c4459ffc8": {
            "title": "Walls And Bridges (TOCP-70396)",
            "original_year": "1974"
          },
          "cd5074c1-8349-40f2-9fcf-b112a6058bb0": {
            "title": "Walls And Bridges PT-SHM",
            "original_year": "1974"
          },
          "8bbe5073-1ec6-417f-b660-d7f6175200ad": {
            "title": "Rock 'N' Roll",
            "original_year": "1975"
          },
          "a987ef47-ff37-4a31-80b7-e0af0044e399": {
            "title": "Rock 'N' Roll",
            "original_year": "1975"
          },
          "d319b0b3-9f19-4b43-b285-0bf7c00acca6": {
            "title": "Rock 'N' Roll",
            "original_year": "1975"
          },
          "f05b253c-9d62-43e2-9ab3-96cf6361975c": {
            "title": "Rock 'N' Roll",
            "original_year": "1975"
          },
          "0b19541d-c105-4b11-822e-ae1a9cfdd805": {
            "title": "Rock 'N' Roll (2010 Remaster)",
            "original_year": "1975"
          },
          "6a70bfc9-bb8f-49d8-bb8c-59026190b9cf": {
            "title": "Rock 'N' Roll (TOCP-70397)",
            "original_year": "1975"
          },
          "5d393215-7265-4f4b-9c11-6de489434150": {
            "title": "Rock 'N' Roll PT-SHM",
            "original_year": "1975"
          },
          "3000c38c-4dc1-41b1-9d13-2aa59a2f12c5": {
            "title": "Shaved  Fish",
            "original_year": "1975"
          },
          "0fb82f34-461d-42c2-a315-81ce9b30e64c": {
            "title": "Shaved Fish",
            "original_year": "1975"
          },
          "7f13b9a8-737b-4884-ad79-c688bf4aa37a": {
            "title": "Double Fantasy",
            "original_year": "1980"
          },
          "33eaf02a-e657-4840-a3ad-0b4dc758ec6a": {
            "title": "Double Fantasy (CDP 7 91425 2)",
            "original_year": "1980"
          },
          "8306dec5-8589-4277-92c0-521b035ce2b0": {
            "title": "Double Fantasy (TOCP-70399)",
            "original_year": "1980"
          },
          "a144dae0-49f0-441c-a262-c01975f4ab0f": {
            "title": "Double Fantasy PT-SHM",
            "original_year": "1980"
          },
          "20dc6902-2bd9-483c-bc60-0fc5266d0da1": {
            "title": "John & Yoko - The Interview",
            "original_year": "1980"
          },
          "7dce273b-bacf-4445-8b79-a2d53274cec9": {
            "title": "The John Lennon Collection (CDP 7 91516 2)",
            "original_year": "1982"
          },
          "72a59ed0-9209-4911-8d83-19cb931e2e84": {
            "title": "Milk And Honey",
            "original_year": "1984"
          },
          "9ee261ca-cd97-4602-a579-940818d40925": {
            "title": "Milk and Honey",
            "original_year": "1984"
          },
          "c951c81a-279f-4f18-9dcc-7a49d53d3002": {
            "title": "Milk And Honey (2010 Remaster)",
            "original_year": "1984"
          },
          "e23d83c1-b174-435a-835a-8a7833895427": {
            "title": "Milk And Honey (TOCP-70400)",
            "original_year": "1984"
          },
          "29cc8ab9-0812-4b06-9c0a-5db58c597b63": {
            "title": "Milk and Honey [Remastered 2001]",
            "original_year": "1984"
          },
          "f0ea4646-9c20-42cd-9876-de297c8b51ba": {
            "title": "Live In New York City",
            "original_year": "1986"
          },
          "f727714a-0833-4ef3-ada1-781ab69256cb": {
            "title": "Menlove Ave",
            "original_year": "1986"
          },
          "ede748cc-3352-4493-a6cd-b0eee68a689d": {
            "title": "Imagine - Music From The Motion Picture",
            "original_year": "1988"
          },
          "35d31730-e548-4c34-939e-9f3aba8f4fe3": {
            "title": "Unplugged (Bootleg)",
            "original_year": "1990"
          },
          "de504844-5440-45c4-a60f-247fa5ff6d72": {
            "title": "I Found Out",
            "original_year": "1994"
          },
          "11c330cb-af0e-4d31-9f54-0a4a18430ac2": {
            "title": "The Village Tapes - Last Sessions, Original Release",
            "original_year": "1995"
          },
          "928d1cce-ca3d-4bad-89a2-e4b997ef008f": {
            "title": "John Lennon - The Dakota Beatle Demos",
            "original_year": "1996"
          },
          "b6683989-965f-482b-a8d8-048268d26b37": {
            "title": "John Lennon Lost Lennon tapes Discs 01-02",
            "original_year": "1997"
          },
          "f92a3830-745b-43e4-a5c3-be7681529843": {
            "title": "John Lennon Lost Lennon tapes Discs 03-04",
            "original_year": "1997"
          },
          "f2ee7332-9a49-4a4b-b7c7-36f62a18eb46": {
            "title": "John Lennon Lost Lennon tapes Discs 05-06",
            "original_year": "1997"
          },
          "dc1f5ea1-c857-48e5-bc5a-e38f6cadc3de": {
            "title": "John Lennon Lost Lennon tapes Discs 07-08",
            "original_year": "1997"
          },
          "cb454742-e84d-443e-8e3f-308a94b9e923": {
            "title": "John Lennon Lost Lennon tapes Discs 09-10",
            "original_year": "1997"
          },
          "0ad3da2b-b87d-432f-b613-3d37aafe214e": {
            "title": "John Lennon Lost Lennon tapes Discs 11-12",
            "original_year": "1997"
          },
          "6a227054-94c7-4fa9-baee-362cc554457c": {
            "title": "Lennon Legend - The Very Best Of John Lennon",
            "original_year": "1997"
          },
          "599c940a-10ce-4a83-b2f5-f63199d3b6f5": {
            "title": "Acoustic Masterpieces",
            "original_year": "1998"
          },
          "2b99a254-5741-4171-a5b5-706f0183163a": {
            "title": "Anthology CD 1 - Ascot",
            "original_year": "1998"
          },
          "cfd32006-383d-4a85-bb18-93fdf2382e7f": {
            "title": "Anthology CD 2 - New York City",
            "original_year": "1998"
          },
          "a8e5e889-3716-4a18-907e-c74a1eb857f5": {
            "title": "Anthology CD 3 - The Lost Weekend",
            "original_year": "1998"
          },
          "290669a1-09c5-4bdf-8018-89cd082b9362": {
            "title": "Anthology CD 4 - Dakota",
            "original_year": "1998"
          },
          "7d95cdf1-f70c-42a7-ac07-10789b80e6f3": {
            "title": "dakota boxset",
            "original_year": "1998"
          },
          "cde59653-d85c-4d7f-a6a7-b29a9eabe295": {
            "title": "Excerpts From John Lennon Anthology (Promo)",
            "original_year": "1998"
          },
          "bbbc7011-0a7b-4162-baf2-3f22dbe01de3": {
            "title": "John Lennon Lost Lennon tapes Discs 13-14",
            "original_year": "1998"
          },
          "3bd73122-47f6-406d-b73f-e7a86e81a7c8": {
            "title": "John Lennon Lost Lennon tapes Discs 15-16",
            "original_year": "1998"
          },
          "1d8daaaa-5a97-43c1-a80d-aed277e74ef0": {
            "title": "John Lennon Lost Lennon tapes Discs 17-18",
            "original_year": "1998"
          },
          "dd6e07c4-bc15-4beb-94e0-297734031af2": {
            "title": "John Lennon Lost Lennon tapes Discs 19-20",
            "original_year": "1998"
          },
          "34d1c2f6-6fa1-46d5-8811-b378986847a4": {
            "title": "John Lennon Lost Lennon tapes Discs 21-22",
            "original_year": "1998"
          },
          "4c095f14-dd38-4dda-9a77-076a2ae92c7b": {
            "title": "Wonsaponatime",
            "original_year": "1998"
          },
          "e30c3116-90ab-4f1b-9183-dbdbaa9e996e": {
            "title": "Acoustic",
            "original_year": "2004"
          },
          "d815fa94-73e9-4817-8e0e-fa7d50c02ab2": {
            "title": "In His Own Words",
            "original_year": "2004"
          },
          "c6b5319f-1b3f-45c9-8295-9d152dcd533b": {
            "title": "Alternate Shaved Fish",
            "original_year": "2005"
          },
          "7da4ee3e-5603-4036-8ae5-2965eee0bc5e": {
            "title": "Peace Love and Truth",
            "original_year": "2005"
          },
          "274e77a5-d6f9-4f1c-b45e-02e223981ce4": {
            "title": "Working Class Hero",
            "original_year": "2005"
          },
          "9c24b817-66a1-4296-b808-cfcd93448b2b": {
            "title": "Double Fantasy - Original Album (5099990599026)",
            "original_year": "2010"
          },
          "a2bafc54-1d1c-4b28-81d6-185ceefaa33c": {
            "title": "Double Fantasy / Stripped Down",
            "original_year": "2010"
          },
          "fa018f5f-8c8f-461d-8702-68b7821ee3e3": {
            "title": "Double Fantasy / Stripped Down",
            "original_year": "2010"
          },
          "7f509bb9-e951-4b23-9eef-84e5c6994c9a": {
            "title": "Double Fantasy / Stripped Down (2010 Remaster)",
            "original_year": "2010"
          },
          "e4d43ae4-6687-4e08-afbc-cfb32f48396c": {
            "title": "Double Fantasy / Stripped Down (2010 Remaster)",
            "original_year": "2010"
          },
          "3a726f2d-d5f9-49c2-b427-f36095e2fd3e": {
            "title": "Power To The People: The Hits (5099990664021)",
            "original_year": "2010"
          },
          "53567fd1-3727-4d6c-917d-c68deeec6317": {
            "title": "Singles & Home Tapes",
            "original_year": "2010"
          },
          "f50e8d16-9b1f-424f-98fb-ac98afd5e87b": {
            "title": "The Gold Collection [CD1]",
            "original_year": "2012"
          },
          "3579b0af-52b3-4878-b414-02390efe64ae": {
            "title": "The Gold Collection [CD2]",
            "original_year": "2012"
          },
          "fcabbc00-7355-4135-9132-02a72e2090ed": {
            "title": "The Gold Collection [CD3]",
            "original_year": "2012"
          },
          "22cae293-d526-4fb3-80f7-eef73a962b8b": {
            "title": "The Ultimate Greatest Hits",
            "original_year": "2015"
          },
          "c164cf90-94ea-46e6-a842-b38c10159341": {
            "title": "JOHN ONO LENNON INSTANT KARMA",
            "original_year": "2021"
          }
        }
      }
    },
    {
      "artistId": "ar_00000000-0000-4000-8000-000000000001",
      "catalogName": "015B",
      "scope": "albums",
      "albumIds": [
        "2ecf4e94-f4fb-4da2-afca-a1e91ecdfb65",
        "6ac82ed8-7b32-4f35-af5f-cfb79bfe2187",
        "21241e99-63ad-4cbb-b704-979d66db7c23",
        "f128c67d-486f-4410-8021-f49df8280bf5",
        "b473408c-7539-459d-bc5e-5047658c4a1e",
        "a68cad01-e450-4cd8-a2f6-9560f0ce4c5d",
        "5a68cfc6-e8fe-4fc8-8b9b-b2efa92fed23",
        "3e335e65-e071-4ef5-a5c4-6555e1fbe841",
        "b9f7d3a4-2532-4fc2-b97a-2e2f6b60fc13",
        "cb5ca559-0730-4aca-ab86-ccbd6a102631",
        "979ce5b0-c221-4846-94e8-c6be0ac798ff",
        "5fb20fc5-147b-4ac8-ad53-22a4c7486ecf",
        "313b738a-b5d2-4b70-a505-9ad83acf4d21",
        "a8de2d6f-84ed-4d76-8378-c78db617970f",
        "17a9acc4-8e1e-4051-beb9-075f9cd07e62",
        "7d241951-f2e4-486a-9c24-acfdc56112b1",
        "3e9db8c7-43f5-4998-8c03-d5dbcda0b565",
        "6c7fdbe8-e8fd-4c08-83f5-cf54d9d26067",
        "12c20e5a-80ef-4fc0-a29c-6b36e50e45d6",
        "299956e6-bfd8-4dae-8fac-c2185f6f6cce",
        "0605e45f-f109-4711-9a10-c532c45e193e",
        "8c83d221-e079-4590-8d29-4c77d1b15e29",
        "fabf328a-ae3b-4a03-b642-b1400696d606",
        "9c67b071-19e9-45b2-a028-9d801424ec2a",
        "02c078ab-5cd8-4d6c-b402-a4537ebe3b80",
        "2cae1e91-4b80-4680-a282-049dd587d529",
        "385c7201-8e07-41c9-82ad-dac37ad4fb8c",
        "1a008f0b-cbc8-4fa3-9aab-b4d34f551fcc",
        "d22e1c3b-9078-4e67-9e71-4c92b945d93b",
        "462518cd-a5ca-4961-a969-d5cc69a2d930",
        "4648dccc-a02d-4839-b3b8-140ae468a57a",
        "a314ba03-a413-40b5-bcdc-8175fb7990ef",
        "4dd36690-6ce7-40e7-833e-57b760b347d0",
        "59d7f6e2-4931-4c9d-af93-598075a01828",
        "990cb0b1-832b-4a14-9bc1-0715c7480fed",
        "e93eab23-d991-4bf5-8c08-8f2b95a680c3",
        "80f81f40-d286-40b7-af80-8d7f64202632",
        "0e1d933e-3b59-4378-95fa-fa66c5a856e3",
        "d748fddf-9cad-4eea-a77e-4d731b12b035",
        "66a90f57-b0e1-48a7-a11c-eb8512cfe43f",
        "ef9709df-cb7e-477d-96f0-9ad70aa3d132",
        "fa581b60-7ebe-476e-a9e5-a85c9895a3cb",
        "bcb3380f-71b7-48e6-bed4-132dcf4b8496",
        "2bc52694-50ea-4685-9b17-572e0d076178",
        "a930fb52-de07-47f6-8122-b6b8654bb98a",
        "39523cbd-116f-4adc-9ef4-4dc8c7c659ec",
        "24b68d7f-2b02-4a48-b0f8-03749f2d569d",
        "593cb2ef-1f16-44b0-a26b-37648bbce460",
        "3ec89600-6125-49f7-9045-75b077f67737",
        "9f8e0349-4868-42cf-8812-46fb0a34cb83",
        "29b696b0-7b7d-4e53-85b4-26d61ecafa2c",
        "e3b24e52-139b-4888-becf-e9efa6ab514a",
        "b563ffa1-1afd-4a16-84aa-cdc4d948fe7b",
        "d6806a65-98e8-42af-9db1-a5d9e1f9bfc4",
        "bde45db9-444b-4cf2-ba04-79f23da0a852",
        "b1b58dff-c804-4d75-805b-f6532a8b170b",
        "b7d09aba-9016-404f-8e70-67da07ae4bb5",
        "fb8d9d10-b679-4bf1-9f15-ef3143c6f775",
        "6a2a769a-0f36-4430-bf85-707ce8956e4a",
        "8f51ea2d-e687-45f0-89ba-71463951b8bc",
        "0878e14b-68e3-41c3-a870-4235df2a6301",
        "8dc5276a-572f-4482-9849-55bada077758",
        "92c9e75a-6d2c-4b94-a91d-b745fa56a434",
        "98b50928-dfd8-4e1d-a7b4-907639720bfc",
        "c0ae2edb-19c0-4d4d-a9e0-7a3bf35eb33d",
        "6ccae4ca-a59d-43c4-93f0-57a0d49fb103",
        "85310d61-d6bf-45b1-bfaa-c15fedf1f65f",
        "cddc48fc-9b01-4eb3-9265-f80ea2311f96",
        "31cf1a3e-3b90-4f92-987e-42e9daaf6bfd",
        "ba34d7cb-e8d8-4807-abd1-c0436650fb06",
        "17563e36-12c4-4b07-9a83-ef4c346c90b7",
        "d3bea7ba-9023-4869-ac44-1d0405ea5f26",
        "01f9954d-f42e-42e3-8737-10ddf98df59c",
        "2b724f0b-9597-4f06-b24c-e3a349cf5cdd",
        "70204338-64c9-439a-82c4-9b0f3689082b",
        "b6d3912a-217a-41e9-a736-522390e30ec4",
        "7884e861-b917-4b4f-8a66-e72dcaf844a2",
        "8e568084-db82-4b59-829e-21eab2e79dd8"
      ],
      "reviewed": true,
      "provenance": "ACTUAL_PUBLIC_CATALOG_READ_ONLY",
      "catalogEvidence": {
        "status": "VERIFIED_SCOPED_READ_ONLY",
        "method": "EXPLICIT_DEVELOPMENT_BIBLIOGRAPHIC_REVIEW",
        "catalogRevision": "1793085366.781885",
        "observedAt": "2026-10-27T08:37:56.559909+00:00",
        "anchorId": "2ecf4e94-f4fb-4da2-afca-a1e91ecdfb65",
        "scopeSha256": "af271ba3cffe67bb1d30dfa919c52b1765f07ac6c9811b5dacbb1811aee24b79",
        "facts": {
          "2ecf4e94-f4fb-4da2-afca-a1e91ecdfb65": {
            "title": "015B",
            "original_year": "1990-07-15"
          },
          "6ac82ed8-7b32-4f35-af5f-cfb79bfe2187": {
            "title": "Second Episode",
            "original_year": "1991-07-22"
          },
          "21241e99-63ad-4cbb-b704-979d66db7c23": {
            "title": "015B Live",
            "original_year": "1992-01-01"
          },
          "f128c67d-486f-4410-8021-f49df8280bf5": {
            "title": "The Third Wave",
            "original_year": "1992-08-24"
          },
          "b473408c-7539-459d-bc5e-5047658c4a1e": {
            "title": "The Fourth Movement",
            "original_year": "1993-08-25"
          },
          "a68cad01-e450-4cd8-a2f6-9560f0ce4c5d": {
            "title": "Strikes Back",
            "original_year": "1994-04-01"
          },
          "5a68cfc6-e8fe-4fc8-8b9b-b2efa92fed23": {
            "title": "Big 5",
            "original_year": "1994-11-20"
          },
          "3e335e65-e071-4ef5-a5c4-6555e1fbe841": {
            "title": "The Best Collection",
            "original_year": "1996-03-01"
          },
          "b9f7d3a4-2532-4fc2-b97a-2e2f6b60fc13": {
            "title": "The Sixth Sense - Farewell To The World",
            "original_year": "1996-05-01"
          },
          "cb5ca559-0730-4aca-ab86-ccbd6a102631": {
            "title": "Final Fantasy",
            "original_year": "2006-05-17"
          },
          "979ce5b0-c221-4846-94e8-c6be0ac798ff": {
            "title": "Lucky 7",
            "original_year": "2006-08-30"
          },
          "5fb20fc5-147b-4ac8-ad53-22a4c7486ecf": {
            "title": "Cluster Vol.1",
            "original_year": "2007-08-28"
          },
          "313b738a-b5d2-4b70-a505-9ad83acf4d21": {
            "title": "처음만 힘들지 (애니콜 컬러자켓 CF 배경음악)",
            "original_year": "2008-01-08"
          },
          "a8de2d6f-84ed-4d76-8378-c78db617970f": {
            "title": "20th Century Boy",
            "original_year": "2011-06-21"
          },
          "17a9acc4-8e1e-4051-beb9-075f9cd07e62": {
            "title": "Let Me Go",
            "original_year": "2012-05-30"
          },
          "7d241951-f2e4-486a-9c24-acfdc56112b1": {
            "title": "Let Me Go - Remixes",
            "original_year": "2012-06-27"
          },
          "3e9db8c7-43f5-4998-8c03-d5dbcda0b565": {
            "title": "80",
            "original_year": "2012-07-30"
          },
          "6c7fdbe8-e8fd-4c08-83f5-cf54d9d26067": {
            "title": "015B Anthology Part.1",
            "original_year": "2017-09-29"
          },
          "12c20e5a-80ef-4fc0-a29c-6b36e50e45d6": {
            "title": "015B Anthology Part.2",
            "original_year": "2017-11-14"
          },
          "299956e6-bfd8-4dae-8fac-c2185f6f6cce": {
            "title": "015B Anthology Part.3",
            "original_year": "2017-12-08"
          },
          "0605e45f-f109-4711-9a10-c532c45e193e": {
            "title": "015B Anthology Part.4",
            "original_year": "2017-12-29"
          },
          "8c83d221-e079-4590-8d29-4c77d1b15e29": {
            "title": "015b Anthology Part.5",
            "original_year": "2018-01-18"
          },
          "fabf328a-ae3b-4a03-b642-b1400696d606": {
            "title": "015B Anthology Part.6",
            "original_year": "2018-02-13"
          },
          "9c67b071-19e9-45b2-a028-9d801424ec2a": {
            "title": "New Edition 01",
            "original_year": "2018-03-19"
          },
          "02c078ab-5cd8-4d6c-b402-a4537ebe3b80": {
            "title": "Anthology",
            "original_year": "2018-04-16"
          },
          "2cae1e91-4b80-4680-a282-049dd587d529": {
            "title": "New Edition 02",
            "original_year": "2018-04-25"
          },
          "385c7201-8e07-41c9-82ad-dac37ad4fb8c": {
            "title": "The Legacy 01",
            "original_year": "2018-05-11"
          },
          "1a008f0b-cbc8-4fa3-9aab-b4d34f551fcc": {
            "title": "New Edition 03",
            "original_year": "2018-06-20"
          },
          "d22e1c3b-9078-4e67-9e71-4c92b945d93b": {
            "title": "New Edition 04",
            "original_year": "2018-07-17"
          },
          "462518cd-a5ca-4961-a969-d5cc69a2d930": {
            "title": "The Legacy 02",
            "original_year": "2018-08-14"
          },
          "4648dccc-a02d-4839-b3b8-140ae468a57a": {
            "title": "New Edition 05",
            "original_year": "2018-09-10"
          },
          "a314ba03-a413-40b5-bcdc-8175fb7990ef": {
            "title": "The Legacy 03",
            "original_year": "2018-10-19"
          },
          "4dd36690-6ce7-40e7-833e-57b760b347d0": {
            "title": "New Edition 06",
            "original_year": "2018-11-20"
          },
          "59d7f6e2-4931-4c9d-af93-598075a01828": {
            "title": "New Edition 07",
            "original_year": "2018-12-18"
          },
          "990cb0b1-832b-4a14-9bc1-0715c7480fed": {
            "title": "The Legacy 04",
            "original_year": "2019-01-15"
          },
          "e93eab23-d991-4bf5-8c08-8f2b95a680c3": {
            "title": "New Edition 08",
            "original_year": "2019-02-24"
          },
          "80f81f40-d286-40b7-af80-8d7f64202632": {
            "title": "Yearbook 2018",
            "original_year": "2019-02-27"
          },
          "0e1d933e-3b59-4378-95fa-fa66c5a856e3": {
            "title": "New Edition 09",
            "original_year": "2019-03-12"
          },
          "d748fddf-9cad-4eea-a77e-4d731b12b035": {
            "title": "New Edition 10",
            "original_year": "2019-04-19"
          },
          "66a90f57-b0e1-48a7-a11c-eb8512cfe43f": {
            "title": "New Edition 11",
            "original_year": "2019-05-14"
          },
          "ef9709df-cb7e-477d-96f0-9ad70aa3d132": {
            "title": "New Edition 12",
            "original_year": "2019-06-18"
          },
          "fa581b60-7ebe-476e-a9e5-a85c9895a3cb": {
            "title": "New Edition 13",
            "original_year": "2019-07-16"
          },
          "bcb3380f-71b7-48e6-bed4-132dcf4b8496": {
            "title": "New Edition 14",
            "original_year": "2019-08-14"
          },
          "2bc52694-50ea-4685-9b17-572e0d076178": {
            "title": "The Legacy 05",
            "original_year": "2019-09-17"
          },
          "a930fb52-de07-47f6-8122-b6b8654bb98a": {
            "title": "New Edition 15",
            "original_year": "2019-10-17"
          },
          "39523cbd-116f-4adc-9ef4-4dc8c7c659ec": {
            "title": "The Legacy 06",
            "original_year": "2019-11-07"
          },
          "24b68d7f-2b02-4a48-b0f8-03749f2d569d": {
            "title": "New Edition 16",
            "original_year": "2019-12-13"
          },
          "593cb2ef-1f16-44b0-a26b-37648bbce460": {
            "title": "New Edition 1988",
            "original_year": "2020-01-15"
          },
          "3ec89600-6125-49f7-9045-75b077f67737": {
            "title": "New Edition 17",
            "original_year": "2020-02-12"
          },
          "9f8e0349-4868-42cf-8812-46fb0a34cb83": {
            "title": "Yearbook 2019",
            "original_year": "2020-02-27"
          },
          "29b696b0-7b7d-4e53-85b4-26d61ecafa2c": {
            "title": "New Edition 18",
            "original_year": "2020-03-18"
          },
          "e3b24e52-139b-4888-becf-e9efa6ab514a": {
            "title": "New Edition 19",
            "original_year": "2020-04-14"
          },
          "b563ffa1-1afd-4a16-84aa-cdc4d948fe7b": {
            "title": "New Edition 20",
            "original_year": "2020-05-19"
          },
          "d6806a65-98e8-42af-9db1-a5d9e1f9bfc4": {
            "title": "New Edition 21",
            "original_year": "2020-06-18"
          },
          "bde45db9-444b-4cf2-ba04-79f23da0a852": {
            "title": "New Edition 22",
            "original_year": "2020-07-13"
          },
          "b1b58dff-c804-4d75-805b-f6532a8b170b": {
            "title": "New Edition 23",
            "original_year": "2020-08-19"
          },
          "b7d09aba-9016-404f-8e70-67da07ae4bb5": {
            "title": "New Edition 24",
            "original_year": "2020-09-17"
          },
          "fb8d9d10-b679-4bf1-9f15-ef3143c6f775": {
            "title": "New Edition 1992",
            "original_year": "2020-10-13"
          },
          "6a2a769a-0f36-4430-bf85-707ce8956e4a": {
            "title": "New Edition 25",
            "original_year": "2020-11-19"
          },
          "8f51ea2d-e687-45f0-89ba-71463951b8bc": {
            "title": "New Edition 26",
            "original_year": "2020-12-16"
          },
          "0878e14b-68e3-41c3-a870-4235df2a6301": {
            "title": "New Edition 27",
            "original_year": "2021-01-16"
          },
          "8dc5276a-572f-4482-9849-55bada077758": {
            "title": "New Edition 28",
            "original_year": "2021-02-09"
          },
          "92c9e75a-6d2c-4b94-a91d-b745fa56a434": {
            "title": "Yearbook 2020",
            "original_year": "2021-02-25"
          },
          "98b50928-dfd8-4e1d-a7b4-907639720bfc": {
            "title": "New Edition 29",
            "original_year": "2021-03-16"
          },
          "c0ae2edb-19c0-4d4d-a9e0-7a3bf35eb33d": {
            "title": "New Edition 30",
            "original_year": "2021-04-20"
          },
          "6ccae4ca-a59d-43c4-93f0-57a0d49fb103": {
            "title": "New Edition 31",
            "original_year": "2021-05-10"
          },
          "85310d61-d6bf-45b1-bfaa-c15fedf1f65f": {
            "title": "The Legacy 00",
            "original_year": "2021-06-14"
          },
          "cddc48fc-9b01-4eb3-9265-f80ea2311f96": {
            "title": "The Legacy 07",
            "original_year": "2021-07-19"
          },
          "31cf1a3e-3b90-4f92-987e-42e9daaf6bfd": {
            "title": "New Edition 32",
            "original_year": "2021-08-18"
          },
          "ba34d7cb-e8d8-4807-abd1-c0436650fb06": {
            "title": "New Edition 33",
            "original_year": "2021-09-13"
          },
          "17563e36-12c4-4b07-9a83-ef4c346c90b7": {
            "title": "New Edition 34",
            "original_year": "2021-10-26"
          },
          "d3bea7ba-9023-4869-ac44-1d0405ea5f26": {
            "title": "New Edition 35",
            "original_year": "2021-11-16"
          },
          "01f9954d-f42e-42e3-8737-10ddf98df59c": {
            "title": "New Edition 36",
            "original_year": "2021-12-07"
          },
          "2b724f0b-9597-4f06-b24c-e3a349cf5cdd": {
            "title": "Yearbook 2021",
            "original_year": "2022-02-24"
          },
          "70204338-64c9-439a-82c4-9b0f3689082b": {
            "title": "New Edition 49",
            "original_year": "2023-03-22"
          },
          "b6d3912a-217a-41e9-a736-522390e30ec4": {
            "title": "New Edition 56",
            "original_year": "2023-11-15"
          },
          "7884e861-b917-4b4f-8a66-e72dcaf844a2": {
            "title": "The Legacy 13",
            "original_year": "2024-02-08"
          },
          "8e568084-db82-4b59-829e-21eab2e79dd8": {
            "title": "Yearbook 2023",
            "original_year": "2024-02-28"
          }
        }
      }
    }
  ],
  "relationships": [
    {
      "key": "mb-membership-lennon-beatles-reviewed-20261027",
      "from": "ar_00000000-0000-4000-8000-000000000002",
      "to": "ar_00000000-0000-4000-8000-000000000003",
      "type": "membership",
      "begin": "1960",
      "end": "1969-09",
      "ended": true,
      "attributes": [
        "guitar",
        "lead vocals"
      ],
      "verified": true,
      "source": {
        "provider": "MusicBrainz webpage (indexed)",
        "url": "https://musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d/relationships",
        "fetchedAt": "2026-10-27",
        "verification": "source-page-reviewed; NOT_API_JSON"
      }
    }
  ],
  "relationshipRevision": 0,
  "catalog_connection": "ACTUAL_READ_ONLY_SCOPES_REVIEWED_ONLY"
};
