class Solution(object):
    def searchInsert(self, nums, target):
        """
        :type nums: List[int]
        :type target: int
        :rtype: int
        """
        left, right = 0, len(nums) - 1

        # 空数组
        if right < left:
            return 0

        if right >= left:
            mid = (left + right + 1) // 2

            # 找到目标值
            if target == nums[mid]:
                return mid

            if target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1

        return left + 1
        
    
num1 = [1, 3, 5, 6]
target = 5
solution = Solution()
print(solution.searchInsert(num1, target))