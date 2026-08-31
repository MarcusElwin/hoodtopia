/**
 * Trace markers shared between the server-side scenario runner and the client
 * console. Kept in their own module so the client bundle does not have to
 * import the scenario code to know when a run has finished.
 */
export const SCENARIO_COMPLETE = "__scenario_complete__";
