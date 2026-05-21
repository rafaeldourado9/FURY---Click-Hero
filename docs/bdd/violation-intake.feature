Feature: Violation Intake

  Scenario: Receive a valid violation webhook
    Given a valid violation payload with adId "ad_123" and tenantId "tenant_abc"
    When the webhook is submitted to POST /webhook/violation
    Then the system should enqueue a takedown job
    And the API should return status 202
    And the response should contain the jobId "tenant_abc:ad_123"

  Scenario: Reject an invalid violation webhook
    Given an invalid violation payload missing adId
    When the webhook is submitted to POST /webhook/violation
    Then the API should return status 400
    And the response should contain validation errors

  Scenario: Idempotent submission with same adId and tenantId
    Given a violation payload with adId "ad_123" and tenantId "tenant_abc"
    When the webhook is submitted twice
    Then both responses should contain the same jobId
    And only one job should exist in the queue
