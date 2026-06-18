const MockTest = require("../models/MockTest");

const getStudentTenantId = (req) => {
  return req.user.tenantId;
};

const buildStudentMockTestListItem = (mockTest) => {
  return {
    _id: mockTest._id,
    title: mockTest.title,
    slug: mockTest.slug,
    description: mockTest.description,
    testType: mockTest.testType,
    accessType: mockTest.accessType,
    price: mockTest.price,
    salePrice: mockTest.salePrice,
    isPurchasable: mockTest.isPurchasable,
    examPattern: mockTest.examPatternId
      ? {
          _id: mockTest.examPatternId._id,
          name: mockTest.examPatternId.name,
          examType: mockTest.examPatternId.examType,
          totalDurationMinutes: mockTest.examPatternId.totalDurationMinutes,
        }
      : null,
    activeVersion: mockTest.activeVersionId
      ? {
          _id: mockTest.activeVersionId._id,
          versionNumber: mockTest.activeVersionId.versionNumber,
          publishedAt: mockTest.activeVersionId.publishedAt,
        }
      : null,
    settings: {
      maxAttempts: mockTest.settings?.maxAttempts,
      interfaceMode: mockTest.settings?.interfaceMode,
      showResultImmediately: mockTest.settings?.showResultImmediately,
      solutionVisibility: mockTest.settings?.solutionVisibility,
    },
    publishedAt: mockTest.publishedAt,
  };
};

const getPublishedMockTestsForStudent = async (req, res) => {
  try {
    const tenantId = getStudentTenantId(req);

    const filter = {
      tenantId,
      isActive: true,
      isPublished: true,
    };

    if (req.query.testType) {
      filter.testType = req.query.testType;
    }

    if (req.query.accessType) {
      filter.accessType = req.query.accessType;
    }

    const mockTests = await MockTest.find(filter)
      .select(
        "title slug description testType accessType price salePrice isPurchasable examPatternId activeVersionId settings.maxAttempts settings.interfaceMode settings.showResultImmediately settings.solutionVisibility publishedAt createdAt"
      )
      .populate("examPatternId", "name examType totalDurationMinutes")
      .populate("activeVersionId", "versionNumber publishedAt")
      .sort({ publishedAt: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: mockTests.length,
      data: mockTests.map(buildStudentMockTestListItem),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getPublishedMockTestsForStudent,
};