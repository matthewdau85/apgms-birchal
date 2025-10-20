import { test } from "node:test";
import assert from "node:assert/strict";
import { As4Envelope, signEnvelope, verifyEnvelope } from "../src/as4.js";

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDk3LPBVRPAEFve
e10R0JGqTZR8zRRKVtwSrc6X4o/8tuZewtmur4/Y/vlRadlF03UGsbSG+M1GF8tF
VntP2MAxHqLGufEy1ZEPWoLyr9dBq1Dd161ls8NURm0CSYolYWtwyaqN5dD72Hte
J21BmEFGkhAOwTHDMoJq4yv8BI71LqpRf3NCNWvwVe3f36GkEFIeNDSMZfQpaxGL
Rf8hbQ9v9eL+Cabq9iMKLW7XXjRna6+JmsTJyC+qgw3pVsjARe7RjkYehxMqjlMY
AUxj4iCONHUGgu7D7pTnmhKdeZoZ0Org++I/hlay0Gd5d3PpcFDIl1a+x/y8SMmc
9NsH4qknAgMBAAECggEAAM1Ti4PM5CZcvgeWCKMCv24ushFVnd6d/0nWhhzKL0Dm
Ak6bvRdHCMdy/hwYgFQRZrG6TsZ6Yc/H0Az2+Cj1nHR9E6xigNP7Hf59CphKlKGs
twvLJYsg+0zjswilIPkdpRPGvrurd8d3aY330XQ3aDGFxgW9rRLxRcm7WRljDVUw
k3E/idOkIiGzOgpwJx1KMDQ1ix3qz5Exk/8AW1JXQE5/+7o7NZdJVRHVgKu5oweb
oPRn1nfaCPn2luVkZEJWSWty4QKLTlKiAkbFZt1OhfsguPfRsp6vzg/J8SO4h9JS
BKsygLrmMDJU/ODkUPYFIdbsPuSal32WnzlMe7iDQQKBgQD1ErwZtoQ2klaeAWtU
24t8kTsRvrQ+0fcxHIzNIOSxtEH5JgJXGliqaMDoRIVLjnE6XnXhM2KPMDiS1k8u
D4J7TfLM1J8KAj+to7hg4ZaEd0589j7cVM9v9Svq3sqndlRaHSzfQbHACOhLcQ17
termAlLl7S2kxibtv2LxSM9iBwKBgQDvEO8vFwHDFw3DOED70Az+WAGhoCaIC71u
7N5bFpz9r84ilvzae1XGoi6EBZY4wV4J4cO4eziIdN/GB65jo+V21mZ62jJhMDqo
1KBjuiCzxpbjSyXjGMy0Rk6q9ETcnc4pdhgyLXcAPTFL8wtwfF4Ymq9QW4CCn3R4
wSz/rII34QKBgQDKlOgEYUk9Sw5qokW06Z6OJAcuDfQ1EZ9Ca5VAY3ZoJtd6Op8o
nVC53MnJtgpxgJe8ZiUPOUi5kGTTjG/7ZTq47qBMDV5CCcXVpUZeX1vquCybQ3qG
61xl8caR6gSfFUN5EjDrhASI91P+OL+qiaBY7YbVJY/bayj20oPZbBRxtQKBgEwA
gzniQ5IlKx/sK2Si0O6vRd1/T6CisteoAEzPFJvmH0+J1tsSqMNcXhNkv0xN1Tqp
BpMIwYFIPrfzSzKsMVAlezEFW0zgi1WPO2pZCvp8YQ3jnyjignmxfGMHAzlsBdXS
kICrSZDO43Q00Wcycqu5yZBvdpyQWvPk3gxuaHuhAoGAKEI0J7iIQZQ+2SUAGYug
gIinqGQox3vR4DIh09tHgv4eYi2TBDYrYST80jvieJobtjA408fb6jn5Gv+HLyqj
uYvnwObAAg7HZskFz6JvfqOx3Mr9sNLU6i9GJGmZ1VZ1paRXeSYwr0V9v4mov+S0
ERiDf/iqoZMxq+zI0PfLpN8=
-----END PRIVATE KEY-----`;

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5NyzwVUTwBBb3ntdEdCR
qk2UfM0USlbcEq3Ol+KP/LbmXsLZrq+P2P75UWnZRdN1BrG0hvjNRhfLRVZ7T9jA
MR6ixrnxMtWRD1qC8q/XQatQ3detZbPDVEZtAkmKJWFrcMmqjeXQ+9h7XidtQZhB
RpIQDsExwzKCauMr/ASO9S6qUX9zQjVr8FXt39+hpBBSHjQ0jGX0KWsRi0X/IW0P
b/Xi/gmm6vYjCi1u1140Z2uviZrEycgvqoMN6VbIwEXu0Y5GHocTKo5TGAFMY+Ig
jjR1BoLuw+6U55oSnXmaGdDq4PviP4ZWstBneXdz6XBQyJdWvsf8vEjJnPTbB+Kp
JwIDAQAB
-----END PUBLIC KEY-----`;

const ENVELOPE: As4Envelope = {
  messageId: "11111111-1111-1111-1111-111111111111",
  createdAt: "2024-01-01T00:00:00.000Z",
  payload: {
    formType: "BAS",
    orgId: "org-123",
    period: "2024-09",
    totals: {
      payable: 12345,
      refundable: 23456,
    },
  },
};

test("creates deterministic detached signature", () => {
  const signature = signEnvelope(ENVELOPE, PRIVATE_KEY);
  assert.deepStrictEqual(signature, {
    algorithm: "RSA-SHA256",
    value:
      "Gqd59jFly20WH1IG7p6VzAnpRg0NqgTtSljuI+/XrIgsg9NLxUQUgJtbNsyMsc1EBWmQh1qtm1jHik9Q/YmOA4f/9LV+77DQCj++yeDGKq5lLUPonkfD+oES0kAr2lm1lcU6AimCNQythb5/30GOvEK1+LRdpoiCsvqODk+vaNA+WFk8A18g/b+PB+r/5DfEzyHdwIX/12+SiNBpab3eKwjEFUHFwan0Ll/qO1Pj1c9rWrGPhGnfN+yd5DCr5FrKl3bKOtOBjFpxUbybHZOTqAc9ujTnFoIRogzoXjh9H9B3mTo60RxLTOSIkJgfzpNeHeCJ5HbJUDBs06crCwWHpQ==",
  });
});

test("verifies the detached signature", () => {
  const signature = signEnvelope(ENVELOPE, PRIVATE_KEY);
  assert.equal(verifyEnvelope(ENVELOPE, signature, PUBLIC_KEY), true);
});

test("detects tampering", () => {
  const signature = signEnvelope(ENVELOPE, PRIVATE_KEY);
  const tampered: As4Envelope = {
    ...ENVELOPE,
    payload: { ...ENVELOPE.payload, period: "2024-12" },
  };
  assert.equal(verifyEnvelope(tampered, signature, PUBLIC_KEY), false);
});
