Feature: Takedown Execution

  Scenario: Process takedown successfully
    Given a takedown job is waiting in the queue
    When the worker processes the job
    And the external API returns 2xx
    Then the job should be marked as completed
    And the job result should contain success true
    And the result should contain externalStatusCode 200

  Scenario: Retry takedown on external failure
    Given a takedown job is waiting in the queue
    When the external API returns 5xx
    Then the job should be retried
    And the retry should use exponential backoff
    And the maximum attempts should be 3

  Scenario: Mark job as failed after all retries are exhausted
    Given a takedown job is waiting in the queue
    When the external API returns 5xx on all 3 attempts
    Then the job should be marked as failed
    And the error should be recorded
