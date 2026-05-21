Feature: Job Monitoring

  Scenario: Query existing completed job status
    Given a completed takedown job with id "tenant_abc:ad_123"
    When I request GET /jobs/tenant_abc:ad_123
    Then the API should return status 200
    And the response should contain jobId, status, attempts, result and error
    And the status should be "completed"
    And the result should contain success true

  Scenario: Query nonexistent job
    Given a takedown job with id "unknown:job" does not exist
    When I request GET /jobs/unknown:job
    Then the API should return status 404
